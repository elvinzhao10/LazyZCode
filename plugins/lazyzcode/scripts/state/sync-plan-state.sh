#!/usr/bin/env bash
# sync-plan-state.sh — Reconcile plan checkboxes with state.json tasks/progress (G-017 fix).
# Usage: sync-plan-state.sh <run_id> [--fix]
#
# G-017: plan.md checkboxes and state.json tasks[]/progress{} are two representations
# that can diverge (e.g. a checkbox is flipped but update-task.sh wasn't called, or
# progress counters drift). This script detects drift and, with --fix, reconciles:
#   - progress.total_checkboxes / completed_checkboxes recomputed from the plan
#   - task.status synced to match checkbox state (checked -> done, unchecked -> pending)
#   - plan-only tasks (in plan but not in tasks[]) reported (not auto-created)
#
# Without --fix: prints a drift report and exits 0 (no writes).
set -euo pipefail

# T3: progressive-milestone graph validation mode (v1.3.0). Validates a parent
# plan JSON for cycles, missing IDs, dangling child links, provisional
# non-dispatch, and canonical decision-gate shape. Additive; does not affect the
# checkbox-sync behaviour below.
if [ "${1:-}" = "--validate-milestones" ]; then
    PLAN_JSON="${2:-}"
    if [ -z "$PLAN_JSON" ] || [ ! -f "$PLAN_JSON" ]; then
        echo "Error: --validate-milestones requires a plan JSON file" >&2
        exit 2
    fi
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PLUGIN_ROOT="$(cd -P -- "$SCRIPT_DIR/../.." && pwd -P)"
    python3 - "$PLAN_JSON" <<'PYEOF'
import json, sys
sys.path.insert(0, str(__import__('pathlib').Path(sys.argv[0]).resolve().parent.parent / "tooling"))
from lazyzcode_adaptive_planning import (
    validate_plan_graph, validate_decision_gate, next_dispatchable_milestone,
)
plan_file = sys.argv[1]
try:
    plan = json.load(open(plan_file, encoding="utf-8"))
except (OSError, ValueError) as exc:
    print("Error: invalid plan JSON: %s" % exc, file=sys.stderr)
    sys.exit(2)
errors = validate_plan_graph(plan)
print("=== milestone graph validation for %s ===" % plan_file)
if errors:
    print("INVALID (%d):" % len(errors))
    for e in errors:
        print("  - " + e)
    sys.exit(1)
nxt = next_dispatchable_milestone(plan)
print("VALID — graph is acyclic with resolvable links and scoped gates.")
print("next dispatchable milestone: %s" % (nxt["id"] if nxt else "none"))
sys.exit(0)
PYEOF
    exit $?
fi

RUN_ID="${1:-}"
FIX="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/state-paths.sh"

if ! state_require_safe_run_id "$RUN_ID"; then
    exit 1
fi

CWD="${CWD:-.}"
state_require_run_dir "$CWD" "$RUN_ID" || exit 1
STATE_FILE="$STATE_RUN_DIR/state.json"
EVENTS_FILE="$STATE_RUN_DIR/events.jsonl"
state_require_existing_run_file "$STATE_FILE" "state.json" || exit 1
state_require_safe_run_file "$EVENTS_FILE" "events.jsonl" || exit 1
if [ ! -f "$STATE_FILE" ]; then
    echo "Error: state.json not found for run '$RUN_ID'" >&2
    exit 1
fi

if [ "$FIX" = "--fix" ]; then
    state_begin_snapshot "$STATE_RUN_DIR" || exit 1
fi

PLAN_REF=$(python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1]) as handle:
    print(json.load(handle).get('plan_reference', ''))
PY
) || PLAN_REF=""
if [ -z "$PLAN_REF" ]; then
    echo "Error: no plan_reference in state.json for run '$RUN_ID'" >&2
    exit 1
fi

state_resolve_plan_reference "$CWD" "$PLAN_REF" || exit 1
PLAN_PATH="$STATE_PLAN_PATH"
state_require_existing_run_file "$PLAN_PATH" "plan file" || exit 1
if [ ! -f "$PLAN_PATH" ]; then
    echo "Error: plan file not found: $PLAN_PATH" >&2
    exit 1
fi

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TMP_FILE=$(mktemp "$STATE_RUN_DIR/.state.json.XXXXXX")
EVENTS_TMP=$(mktemp "$STATE_RUN_DIR/.events.jsonl.XXXXXX")
# v1.3.0 T4: reconcile tooling lives in the plugin's tooling/ dir.
PLUGIN_TOOLING="$(cd -P -- "$SCRIPT_DIR/../.." && pwd -P)/tooling"
cleanup_transaction_temps() { rm -f "$TMP_FILE" "$EVENTS_TMP"; }
trap cleanup_transaction_temps EXIT

python3 - "$STATE_FILE" "$PLAN_PATH" "$FIX" "$NOW" "$RUN_ID" "$CWD" "$TMP_FILE" "$EVENTS_FILE" "$EVENTS_TMP" "$PLUGIN_TOOLING" <<'PYEOF'
import json, sys, re, os, hashlib

state_file, plan_path, fix, now, run_id, cwd, tmp_file, events_file, events_tmp, plugin_tooling = sys.argv[1:]
fix = (fix == "--fix")
if plugin_tooling:
    sys.path.insert(0, plugin_tooling)

with open(state_file) as f:
    state = json.load(f)
with open(plan_path) as f:
    plan_text = f.read()
    plan_lines = plan_text.splitlines(keepends=True)

# --- v1.3.0 T4: approved-plan-revision reconciliation at the sync boundary ---
run_dir = os.path.dirname(state_file)
revision_path = os.path.join(run_dir, "checkpoints", "plan-revision.md")
reconciliation_event = None
try:
    from lazyzcode_plan_reconcile import classify_plan_edits
    if os.path.exists(revision_path):
        with open(revision_path) as f:
            approved_text = f.read()
        if hashlib.sha256(plan_text.encode()).hexdigest() != hashlib.sha256(approved_text.encode()).hexdigest():
            reconciliation = classify_plan_edits(approved_text, plan_text)
            reconciliation_event = {
                "ts": now, "run_id": run_id, "event": "plan_reconciled",
                "classification": reconciliation["classification"],
                "invalidations": reconciliation["invalidations"],
                "reopen": reconciliation["reopen"],
                "added": reconciliation["added"],
                "removed": reconciliation["removed"],
                "summary": reconciliation["summary"],
            }
            print("=== plan reconciliation ===")
            print("classification: %s" % reconciliation["classification"])
            for line in reconciliation["summary"]:
                print("  - " + line)
            if fix and reconciliation["classification"] == "semantic":
                invalidated_ids = {i["task"] for i in reconciliation["invalidations"]}
                for task in state.get("tasks", []):
                    tid = task.get("id")
                    if tid in invalidated_ids and task.get("status") == "done":
                        task["status"] = "queued"
                        task["evidence"] = []
                        task["reconciled_reopened"] = True
            if fix and reconciliation["reopen"]:
                for task in state.get("tasks", []):
                    if task.get("id") in reconciliation["reopen"] and task.get("status") == "done":
                        task["status"] = "queued"
                        task["reconciled_reopened"] = True
            if fix:
                os.makedirs(os.path.dirname(revision_path), exist_ok=True)
                rev_tmp = revision_path + ".tmp"
                with open(rev_tmp, "w") as f:
                    f.write(plan_text)
                os.replace(rev_tmp, revision_path)
    else:
        if fix:
            os.makedirs(os.path.dirname(revision_path), exist_ok=True)
            rev_tmp = revision_path + ".tmp"
            with open(rev_tmp, "w") as f:
                f.write(plan_text)
            os.replace(rev_tmp, revision_path)
except ImportError:
    pass


# Parse checkboxes from plan sections. Heading match is EXACT (case-sensitive):
#   "TODOs"      -> canonical heading
#   "Todos"      -> legacy heading (accepted for plan-format compatibility)
#   "Final Verification Wave" -> verification section
# Arbitrary casing is intentionally NOT accepted.
headings = {"TODOs", "Todos", "Final Verification Wave"}
TASK_SECTIONS = {"TODOs", "Todos"}
in_section = False
current_section = None
plan_boxes = []  # {id, id_key, title, checked, section}
fence = None
for line in plan_lines:
    s = line.strip()
    marker = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
    if marker:
        token = marker.group(1)
        if fence is None:
            fence = token
        elif token[0] == fence[0] and len(token) >= len(fence) and s == token:
            fence = None
        continue
    if fence is not None:
        continue
    if s.startswith("## "):
        current_section = s[3:].strip()
        in_section = current_section in headings
        continue
    if not in_section:
        continue
    m = re.match(r"^-\s+\[([ xX])\]\s+(.+)$", line.rstrip())
    if m:
        checked = m.group(1).lower() == "x"
        title = m.group(2).strip()
        # Preserve canonical and legacy identity (T1:, T1., A1.).
        mid = re.match(r"^([A-Za-z]*\d+)\s*[:.]\s*(.+)$", title)
        tid = mid.group(1) if mid else None
        # identity key for duplicate/missing detection: any "Letter+digit" prefix
        # (covers canonical "T1:" and legacy "A1." style prefixes)
        kid = mid
        id_key = kid.group(1) if kid else None
        plan_boxes.append({"id": tid, "id_key": id_key, "title": title,
                           "checked": checked, "section": current_section})

total = len(plan_boxes)
completed = sum(1 for b in plan_boxes if b["checked"])

# --- plan-format compatibility guards (T4: never silently succeed on 0 tasks) ---
# Zero-task guard: a plan that yields no parsed checkboxes means the
# heading format is wrong (e.g. "## Todos" was not recognised). Fail loudly.
if total == 0:
    print("Error: no checkboxes parsed — check plan heading format "
          "(expected '## TODOs' or '## Todos', with '- [ ] Task' lines)",
          file=sys.stderr)
    sys.exit(1)

if not any(box['section'] in TASK_SECTIONS for box in plan_boxes):
    raise SystemExit("Error: no task checkboxes parsed — add a task under '## TODOs' or '## Todos'")

# Duplicate task id detection — preserves task identity.
seen_ids = {}
for box in plan_boxes:
    if not box["id_key"]:
        continue
    seen_ids.setdefault(box["id_key"], []).append(box["title"])
for dup_id, titles in seen_ids.items():
    if len(titles) > 1:
        print("Error: duplicate task id '%s' in plan (%d checkboxes share it):"
              % (dup_id, len(titles)), file=sys.stderr)
        for t in titles:
            print("  - " + t[:80], file=sys.stderr)
        sys.exit(1)

# Missing task id in a task section. The Final Verification Wave section
# legitimately uses id-less checkboxes, so it is exempt from this check.
for box in plan_boxes:
    if box["section"] in TASK_SECTIONS and not box["id_key"]:
        print("Error: checkbox in '%s' is missing a task id "
              "(expected a 'T1:'-style prefix): %s"
              % (box["section"], box["title"][:80]), file=sys.stderr)
        sys.exit(1)

tasks = state.get("tasks", [])
tasks_by_id = {t.get("id"): t for t in tasks if t.get("id")}

drift = []

# 1. progress counter drift
prog = state.get("progress", {})
if prog.get("total_checkboxes") != total or prog.get("completed_checkboxes") != completed:
    drift.append("progress drift: state=%s/%s  plan=%d/%d" % (
        prog.get("completed_checkboxes", 0), prog.get("total_checkboxes", 0), completed, total))

# 2. task.status vs checkbox drift (match by id)
for box in plan_boxes:
    if box["id"] and box["id"] in tasks_by_id:
        t = tasks_by_id[box["id"]]
        box_done = box["checked"]
        task_done = t.get("status") == "done"
        if box_done != task_done:
            drift.append("status drift: %s plan=%s state=%s" % (
                box["id"], "checked" if box_done else "unchecked", t.get("status")))

# 3. plan-only tasks (in plan with id but not in state tasks[])
for box in plan_boxes:
    if box["id"] and box["id"] not in tasks_by_id:
        drift.append("plan-only task: %s '%s' not in state.json tasks[]" % (box["id"], box["title"][:60]))

# Report
print("=== plan<->state sync for run '%s' ===" % run_id)
print("plan: %d checkboxes, %d checked" % (total, completed))
print("state tasks: %d" % len(tasks))
if drift:
    print("DRIFT DETECTED (%d):" % len(drift))
    for d in drift:
        print("  - " + d)
else:
    print("NO DRIFT — plan and state are in sync.")

if not fix:
    if drift:
        print("\n(dry-run; pass --fix to reconcile)")
    sys.exit(0)

# Reconcile
changed = False
# fix progress
if prog.get("total_checkboxes") != total or prog.get("completed_checkboxes") != completed:
    state["progress"] = {"total_checkboxes": total, "completed_checkboxes": completed}
    changed = True
# fix task statuses
for box in plan_boxes:
    if box["id"] and box["id"] in tasks_by_id:
        t = tasks_by_id[box["id"]]
        want = "done" if box["checked"] else "pending"
        if t.get("status") != want:
            t["status"] = want
            changed = True
if changed:
    statuses = {task.get("id"): task.get("status") for task in tasks}
    for task in tasks:
        if task.get("status") == "done":
            incomplete = [dependency for dependency in task.get("depends_on", []) if statuses.get(dependency) != "done"]
            if incomplete:
                raise SystemExit("Error: dependency %s must be done before task '%s'" % (", ".join(incomplete), task.get("id", "?")))
    state["updated_at"] = now
    with open(tmp_file, "w") as f:
        json.dump(state, f, indent=2)
    ev = {"ts": now, "run_id": run_id, "event": "plan_state_synced", "drift_fixed": len(drift)}
    if reconciliation_event is not None:
        ev["reconciliation"] = reconciliation_event
    with open(events_tmp, "w") as output:
        if os.path.exists(events_file):
            with open(events_file) as source:
                output.write(source.read())
        output.write(json.dumps(ev) + "\n")
    print("\nRECONCILED: progress + task statuses updated (%d drift fixed)." % len(drift))
else:
    print("\nNothing to write (only counters/statuses are auto-fixed; plan-only tasks need manual add).")
PYEOF

if [ -s "$TMP_FILE" ]; then
    state_commit_transaction "$STATE_RUN_DIR" sync_plan_state \
        "$(state_transaction_write_arg state.json "$STATE_FILE" "$TMP_FILE")" \
        "$(state_transaction_write_arg events.jsonl "$EVENTS_FILE" "$EVENTS_TMP")"
fi
exit 0
