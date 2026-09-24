#!/usr/bin/env bash
# user-prompt-submit.sh — ZCode UserPromptSubmit hook: adaptive intake.
#
# Keeps the adaptive dual-entry logic:
#   1. runtime_freshness present in the event  -> scripts/runtime-freshness-entry.js resume
#   2. otherwise                               -> tooling/lazyzcode_adaptive_runtime.py
# Both are called only when present (graceful degradation when absent).
# Also detects context-pressure markers (ZCode has no PreCompact event, so
# compaction recovery is re-entered here) and LazyZCode command keywords.
#
# ZCode output contract: print EITHER strict JSON ({"additionalContext": "..."})
# OR nothing on stdout; diagnostics go to stderr. Nothing may block: ALWAYS
# exits 0, never emits a deny/continue-false payload.
set -uo pipefail

SCRIPT_DIR="$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd -P -- "$SCRIPT_DIR/../.." && pwd -P)}"

# --- Read event JSON from stdin defensively (cap input at 1 MiB) ---
INPUT=$(head -c 1048576 || true)
INPUT_FILE=$(mktemp "${TMPDIR:-/tmp}/lazyzcode-ups.XXXXXX")
trap 'rm -f "$INPUT_FILE"' EXIT
printf '%s' "$INPUT" >"$INPUT_FILE"

NOTES="$(ADAPTIVE_RUNTIME="$PLUGIN_ROOT/tooling/lazyzcode_adaptive_runtime.py" \
FRESHNESS_ENTRY="$PLUGIN_ROOT/scripts/runtime-freshness-entry.js" \
python3 - "$INPUT_FILE" <<'PY'
import json
import os
import re
import subprocess
import sys

with open(sys.argv[1], encoding='utf-8', errors='replace') as handle:
    raw = handle.read()
if len(raw) > 1024 * 1024:
    raw = raw[:1024 * 1024]

notes = []


def add(text):
    if text:
        notes.append(text)


def run(cmd, payload):
    try:
        proc = subprocess.run(cmd, input=payload.encode('utf-8'), stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, timeout=8)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return proc.stdout.decode('utf-8', 'replace').strip() or None


unparseable_input = False
try:
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        payload = {}
except json.JSONDecodeError:
    payload = {}
    unparseable_input = True

prompt = payload.get('prompt') or payload.get('user_prompt') or payload.get('message') or ''
if not isinstance(prompt, str):
    prompt = ''

# --- Context-pressure markers (compaction recovery — no PreCompact in ZCode) ---
PRESSURE_MARKERS = (
    'context compacted',
    'context_length_exceeded',
    'skill descriptions were shortened',
    'context_too_large',
    "codex ran out of room in the model's context window",
)
pressure = next((m for m in PRESSURE_MARKERS if m in prompt.lower()), None)
if pressure:
    add(
        '[LazyZCode] Context pressure detected (marker: ' + pressure + '). '
        'Recover context before continuing: re-read the active run state under '
        '.lazyzcode/runs/ (state.json, events.jsonl) and the plan under .lazyzcode/plans/ '
        'instead of trusting stale in-context pointers.'
    )

# --- Adaptive dual-entry (degrade gracefully when machinery is absent) ---
directive = None
freshness = payload.get('runtime_freshness')
freshness_json = ''
if isinstance(freshness, str):
    freshness_json = freshness.strip()
elif freshness is not None:
    freshness_json = json.dumps(freshness, separators=(',', ':'))

freshness_entry = os.environ.get('FRESHNESS_ENTRY', '')
adaptive_runtime = os.environ.get('ADAPTIVE_RUNTIME', '')

if freshness_json and freshness_entry and os.path.isfile(freshness_entry):
    result_text = run(['node', freshness_entry, 'resume'], freshness_json)
    if result_text is None:
        result_text = '{"status":"blocked","completion":"blocked","reason":"malformed-runtime-context"}'
    try:
        result = json.loads(result_text)
    except json.JSONDecodeError:
        result = {'status': 'blocked'}
    status = result.get('status', 'blocked') if isinstance(result, dict) else 'blocked'
    if status != 'resumed':
        blocked = 'blocked:capacity'
        if status == 'stale':
            blocked = 'blocked:stale-context'
        directive = {
            'kind': 'lazyzcode-adaptive-directive',
            'continuation': 'stale-rejected',
            'dispatched': blocked,
            'runtimeFreshness': result if isinstance(result, dict) else {'status': 'blocked'},
        }
        add('[LazyZCode] Adaptive continuation rejected (' + blocked + '). '
            'Resume via /lazy-start-work with a fresh plan; do not continue stale work.')
    elif adaptive_runtime and os.path.isfile(adaptive_runtime):
        out = run(['python3', adaptive_runtime], raw)
        if out:
            try:
                directive = json.loads(out)
                directive['continuation'] = 'resumed'
                directive['runtimeFreshness'] = result
            except json.JSONDecodeError:
                add(out)  # plain-text notice (e.g. secret redaction warning)
elif adaptive_runtime and os.path.isfile(adaptive_runtime):
    out = run(['python3', adaptive_runtime], raw)
    if out:
        try:
            directive = json.loads(out)
        except json.JSONDecodeError:
            add(out)  # plain-text notice (e.g. secret redaction warning)

if isinstance(directive, dict):
    if directive.get('dispatched') == 'blocked:malformed-input':
        # Fail closed with a fixed directive (never echoing input) when the
        # event could not be resolved to a project root.
        directive = {
            'kind': 'lazyzcode-adaptive-directive',
            'dispatched': 'blocked:malformed-input',
            'persistence': 'skipped:malformed-input',
        }
    add('[LazyZCode] Adaptive intake directive: ' + json.dumps(directive, ensure_ascii=False, separators=(',', ':'), sort_keys=True))

# --- Command keyword detection (explicit entry routes) ---
KEYWORD_ROUTES = (
    (r'\bulw-loop\b', 'ulw-loop', '/lazy-ulw-loop'),
    (r'\bulw-plan\b', 'ulw-plan', '/lazy-ulw-plan'),
    (r'\bultrawork\b|\bulw\b', 'ultrawork', '/lazy-ultrawork'),
    (r'\bstart-work\b', 'start-work', '/lazy-start-work'),
    (r'\bhandoff\b', 'handoff', '/lazy-handoff'),
    (r'\bstop-continuation\b', 'stop-continuation', '/lazy-stop-continuation'),
    (r'\bralph-loop\b', 'ralph-loop', '/lazy-ralph-loop'),
    (r'\binit-deep\b', 'init-deep', '/lazy-init-deep'),
    (r'\breview-work\b', 'review-work', '/lazy-review-work'),
    (r'\bremove-ai-slops\b', 'remove-ai-slops', 'the `lazy-remove-ai-slops` skill'),
)
matched = set()
for pattern, keyword, route in KEYWORD_ROUTES:
    if re.search(pattern, prompt, re.I):
        matched.add(keyword)
        if keyword == 'ultrawork' and ('ulw-loop' in matched or 'ulw-plan' in matched):
            continue  # specific ulw-* keyword already routed
        if route.startswith('/'):
            add(f"[LazyZCode] Command keyword '{keyword}' detected — use the `{route}` command (skill `lazy-{keyword}`) for this request.")
        else:
            add(f"[LazyZCode] Command keyword '{keyword}' detected — use {route} for this request.")

if notes:
    print(json.dumps({'additionalContext': '\n'.join(notes)}))
PY
)" || NOTES=""

if [ -n "$NOTES" ]; then
    printf '%s\n' "$NOTES"
fi

exit 0
