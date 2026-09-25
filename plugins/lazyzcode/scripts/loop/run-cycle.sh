#!/usr/bin/env bash
# run-cycle.sh — Run ONE loop iteration.
# Usage: run-cycle.sh <run_id>
set -euo pipefail

RUN_ID="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
source "$SCRIPT_DIR/../state/state-paths.sh"

if ! state_require_safe_run_id "$RUN_ID"; then
    exit 1
fi

CWD="${CWD:-.}"
state_require_run_dir "$CWD" "$RUN_ID" || exit 1
RUN_DIR="$STATE_RUN_DIR"
STATE_FILE="$RUN_DIR/state.json"

state_require_safe_run_file "$STATE_FILE" "state.json" || exit 1
if [ ! -f "$STATE_FILE" ]; then
    echo '{"status":"error","reason":"state.json not found"}' >&2
    exit 1
fi
state_recover_transaction "$RUN_DIR" || exit 1

# Try to get next task
TASK_JSON=$("$SCRIPT_DIR/next-task.sh" "$RUN_ID" 2>/dev/null) || {
    echo '{"status":"complete"}'
    exit 0
}

TASK_ID=$(python3 - "$TASK_JSON" <<'PY'
import json
import sys

try:
    task = json.loads(sys.argv[1])
    value = task["id"]
except (json.JSONDecodeError, KeyError, TypeError):
    print("")
    raise SystemExit(0)
if not isinstance(value, str) or not value.strip():
    print("")
    raise SystemExit(0)
print(value)
PY
)
if [ -z "$TASK_ID" ]; then
    echo '{"status":"error","reason":"next-task returned a task without a usable string id"}' >&2
    exit 1
fi

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TMP_FILE=$(mktemp "$RUN_DIR/.state.json.XXXXXX")
cleanup_transaction_temps() { rm -f "$TMP_FILE"; }
trap cleanup_transaction_temps EXIT
python3 - "$STATE_FILE" "$NOW" "$TMP_FILE" <<'PY'
import json
import sys

state_file, now, tmp_file = sys.argv[1:]
d = json.load(open(state_file))
if d.get('status') not in ('executing',):
    d['status'] = 'executing'
it = d.setdefault('iteration', {})
it['count'] = it.get('count', 0) + 1
d['updated_at'] = now
with open(tmp_file, 'w') as f:
    json.dump(d, f, indent=2)
PY
state_commit_transaction "$RUN_DIR" run_cycle \
    "$(state_transaction_write_arg state.json "$STATE_FILE" "$TMP_FILE")"

# Checkpoint every 5 iterations
ITER_COUNT=$(python3 - "$STATE_FILE" <<'PY'
import json
import sys

print(json.load(open(sys.argv[1]))['iteration']['count'])
PY
)
case "$ITER_COUNT" in
    ''|*[!0-9]*)
        echo '{"status":"error","reason":"run state has a corrupt or missing iteration count"}' >&2
        exit 1
        ;;
esac
if [ $((ITER_COUNT % 5)) -eq 0 ]; then
    CHECKPOINT_SCRIPT="$PLUGIN_ROOT/scripts/state/checkpoint.sh"
    if [ -x "$CHECKPOINT_SCRIPT" ]; then
        "$CHECKPOINT_SCRIPT" "$RUN_ID" >/dev/null
    else
        echo '{"status":"error","reason":"checkpoint script not found"}' >&2
        exit 1
    fi
fi

python3 - "$TASK_JSON" <<'PY'
import json
import sys

print(json.dumps({'status': 'continue', 'task': json.loads(sys.argv[1])}))
PY
