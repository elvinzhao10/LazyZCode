#!/usr/bin/env bash
# stop-gate.sh — ZCode Stop hook: completion-gate reminder.
#
# Reads completion status via the launcher (scripts/completion-assessment.js)
# when resolvable, otherwise falls back to reading .lazyzcode state directly
# (active run + unchecked plan checkboxes). Emits {"additionalContext": ...}.
#
# ZCode output contract: print EITHER strict JSON OR nothing on stdout.
# ADVISORY — ALWAYS exits 0. ZCode continuation semantics differ from earlier
# hosts: this hook never blocks Stop, it only reminds.
set -uo pipefail

# --- Read event JSON from stdin defensively (cap input at 1 MiB) ---
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/bounded-input.bash"
hook_read_input || exit 0

# --- Context pressure detection: pass through gracefully ---
for marker in "context compacted" "context_length_exceeded" "skill descriptions were shortened" "context_too_large"; do
    if grep -qi "$marker" "$HOOK_INPUT_FILE"; then
        exit 0
    fi
done

# --- Stop hook active guard: don't re-remind (prevents loops) ---
STOP_ACTIVE=$(cat "$HOOK_INPUT_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stop_hook_active',''))" 2>/dev/null || echo "")
if [ "$STOP_ACTIVE" = "True" ] || [ "$STOP_ACTIVE" = "true" ]; then
    exit 0
fi

CWD=$(cat "$HOOK_INPUT_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")
[ -n "$CWD" ] || CWD="$PWD"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

REMINDER=""

# --- Preferred path: completion status via the launcher ---
if [ -f "$PLUGIN_ROOT/scripts/completion-assessment.js" ] && command -v node >/dev/null 2>&1; then
    ASSESSMENT=$(node "$PLUGIN_ROOT/scripts/completion-assessment.js" --root "$CWD" 2>/dev/null || true)
    if [ -n "$ASSESSMENT" ]; then
        REMINDER=$(printf '%s' "$ASSESSMENT" | python3 -c '
import json, sys
try:
    a = json.load(sys.stdin)
except Exception:
    raise SystemExit(0)
status = a.get("status", "")
reason = a.get("reason_code", "")
remediation = a.get("remediation", "show_run_status")
if status == "ready":
    raise SystemExit(0)
if status == "uninitialized" and reason == "AUTHORITY_ABSENT":
    # No completion authority — the direct .lazyzcode state check below decides.
    raise SystemExit(3)
print(
    f"[LazyZCode] Completion gate: {status} ({reason}). "
    f"Do not claim completion without verification. Remediation: {remediation}. "
    "Finish the remaining plan criteria with recorded evidence before stopping."
)
' 2>/dev/null)
        LAUNCHER_STATUS=$?
        if [ "$LAUNCHER_STATUS" = "0" ]; then
            # ready, or a reminder was produced
            if [ -n "$REMINDER" ]; then
                printf '%s' "$REMINDER" | python3 -c 'import json,sys; print(json.dumps({"additionalContext": sys.stdin.read()}))'
            fi
            exit 0
        fi
        # status uninitialized/AUTHORITY_ABSENT (or launcher output unparseable) -> fall through
        if [ "$LAUNCHER_STATUS" != "3" ]; then
            REMINDER=""
        fi
    fi
fi

# --- Fallback: read .lazyzcode state directly ---
RUNS_DIR="$CWD/.lazyzcode/runs"
if [ ! -d "$RUNS_DIR" ]; then
    exit 0
fi

ACTIVE_RUN=""
for run_dir in "$RUNS_DIR"/*/; do
    state_file="${run_dir}state.json"
    if [ -f "$state_file" ]; then
        STATUS=$(python3 -c 'import json, sys; d = json.load(open(sys.argv[1])); print(d.get("status", ""))' "$state_file" 2>/dev/null || echo "")
        if [ "$STATUS" = "active" ] || [ "$STATUS" = "paused" ] || [ "$STATUS" = "executing" ] || [ "$STATUS" = "verifying" ] || [ "$STATUS" = "reviewing" ] || [ "$STATUS" = "blocked" ] || [ "$STATUS" = "created" ] || [ "$STATUS" = "planning" ]; then
            ACTIVE_RUN="$run_dir"
            ACTIVE_STATE="$state_file"
            break
        fi
    fi
done

if [ -z "$ACTIVE_RUN" ]; then
    exit 0
fi

PLAN_REF=$(python3 -c 'import json, sys; d = json.load(open(sys.argv[1])); print(d.get("plan_reference", ""))' "$ACTIVE_STATE" 2>/dev/null || echo "")
[ -n "$PLAN_REF" ] || exit 0

if [[ "$PLAN_REF" == /* ]]; then
    PLAN_PATH="$PLAN_REF"
else
    PLAN_PATH="$CWD/$PLAN_REF"
fi

[ -f "$PLAN_PATH" ] || exit 0

# Count top-level work outside fenced examples in supported plan sections.
UNCHECKED=$(python3 - "$PLAN_PATH" <<'PY' 2>/dev/null || true
import re
import sys
with open(sys.argv[1]) as handle:
    lines = handle.readlines()
headings_to_count = {'TODOs', 'Todos', 'Final Verification Wave'}
in_section = False
fence = None
unchecked = []
for line in lines:
    stripped = line.strip()
    marker = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
    if marker:
        token = marker.group(1)
        if fence is None:
            fence = token
        elif token[0] == fence[0] and len(token) >= len(fence) and stripped == token:
            fence = None
        continue
    if fence is not None:
        continue
    if stripped.startswith('## '):
        in_section = stripped[3:].strip() in headings_to_count
        continue
    if not in_section:
        continue
    checkbox = re.match(r'^-\s+\[ \]\s+(.+)$', line.rstrip())
    if checkbox:
        unchecked.append(checkbox.group(1))
if unchecked:
    title = unchecked[0]
    print(f"{len(unchecked)} {title[:77] + '...' if len(title) > 80 else title}")
else:
    print('0')
PY
)
[ -n "$UNCHECKED" ] || UNCHECKED=0

if [ "$UNCHECKED" = "0" ]; then
    exit 0
fi

REMAINING=$(printf '%s' "$UNCHECKED" | awk '{print $1}')
NEXT_TASK=$(printf '%s' "$UNCHECKED" | cut -d' ' -f2-)
PLAN_NAME=$(basename "$PLAN_PATH" .md)

REMINDER="[LazyZCode] Completion gate: $REMAINING unfinished task(s) in plan \`$PLAN_NAME\`. Next: $NEXT_TASK. Do not claim completion without verification. Run /lazy-start-work $PLAN_NAME to continue the planned work."

# --- Emit strict JSON only: {"additionalContext": "<reminder>"} ---
printf '%s' "$REMINDER" | python3 -c 'import json,sys; print(json.dumps({"additionalContext": sys.stdin.read()}))'
exit 0
