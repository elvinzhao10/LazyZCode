#!/usr/bin/env bash
# post-tool-use-failure.sh — ZCode PostToolUseFailure hook: append a failure
# event with a retry/fallback/blocker suggestion to the active run's events.jsonl.
#
# ZCode output contract: print NOTHING on stdout; diagnostics go to stderr.
# Advisory only — ALWAYS exits 0.
set -uo pipefail

# --- Read event JSON from stdin defensively (cap input at 1 MiB) ---
INPUT=$(head -c 1048576 || true)
INPUT_FILE=$(mktemp "${TMPDIR:-/tmp}/lazyzcode-ptuf.XXXXXX")
trap 'rm -f "$INPUT_FILE"' EXIT
printf '%s' "$INPUT" >"$INPUT_FILE"

python3 - "$INPUT_FILE" <<'PY'
import datetime
import glob
import json
import os
import sys

with open(sys.argv[1], encoding='utf-8', errors='replace') as handle:
    try:
        payload = json.loads(handle.read())
    except json.JSONDecodeError:
        raise SystemExit(0)

if not isinstance(payload, dict):
    raise SystemExit(0)

tool_name = payload.get('tool_name')
if not isinstance(tool_name, str):
    raise SystemExit(0)

cwd = payload.get('cwd') or os.getcwd()
if not isinstance(cwd, str) or not cwd:
    raise SystemExit(0)

error_msg = payload.get('error', '')
if not isinstance(error_msg, str):
    error_msg = str(error_msg)
error_msg = error_msg[:200]

error_type = payload.get('error_type', '')
if not isinstance(error_type, str):
    error_type = ''

# --- Classify error and suggest recovery ---
lower = (error_msg + ' ' + error_type).lower()
if 'permission denied' in lower or 'eacces' in lower or 'not permitted' in lower:
    suggestion = 'ask-user: request elevated permissions or alternate path'
elif 'timeout' in lower or 'timed out' in lower or 'etimedout' in lower:
    suggestion = 'retry: operation may succeed with increased timeout or network recovery'
elif 'not found' in lower or 'enoent' in lower or 'no such file' in lower or '404' in lower:
    suggestion = 'fallback: resource not found — verify path/URL exists or use alternative'
elif 'out of memory' in lower or 'oom' in lower or 'killed' in lower:
    suggestion = 'blocker: resource exhausted — reduce scope or increase limits'
else:
    suggestion = 'review: generic failure — check error details and retry or escalate'

# --- Find active run and append event ---
runs_dir = os.path.join(cwd, '.lazyzcode', 'runs')
if not os.path.isdir(runs_dir):
    raise SystemExit(0)

for run_dir in sorted(glob.glob(os.path.join(runs_dir, '*/'))):
    state_file = os.path.join(run_dir, 'state.json')
    if not os.path.isfile(state_file):
        continue
    try:
        with open(state_file, encoding='utf-8') as state_handle:
            state = json.load(state_handle)
    except (json.JSONDecodeError, OSError):
        continue
    if isinstance(state, dict) and state.get('status') in ('active', 'paused', 'created', 'planning', 'executing', 'blocked', 'verifying', 'reviewing'):
        event = {
            'tool': tool_name,
            'status': 'failure',
            'error': error_msg,
            'suggestion': suggestion,
            'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
        }
        try:
            with open(os.path.join(run_dir, 'events.jsonl'), 'a', encoding='utf-8') as event_handle:
                event_handle.write(json.dumps(event, default=str) + '\n')
        except OSError:
            print(json.dumps({'error': 'events_append_failed'}), file=sys.stderr)
        break

raise SystemExit(0)
PY

exit 0
