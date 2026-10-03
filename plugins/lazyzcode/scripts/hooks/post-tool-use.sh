#!/usr/bin/env bash
# post-tool-use.sh — ZCode PostToolUse hook: append tool-use summary to the
# active run's events.jsonl, grep changed files for AI-slop comment markers,
# and delegate to dynamic-rules.sh when present.
#
# ZCode output contract: print NOTHING on stdout; diagnostics go to stderr.
# Advisory only — ALWAYS exits 0.
set -uo pipefail

SCRIPT_DIR="$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

# --- Read event JSON from stdin defensively (cap input at 1 MiB) ---
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/bounded-input.bash"
hook_read_input || exit 0
INPUT_FILE="$HOOK_INPUT_FILE"

SLOP_HIT=$(python3 - "$INPUT_FILE" <<'PY'
import datetime
import glob
import json
import os
import re
import sys

with open(sys.argv[1], encoding='utf-8', errors='replace') as handle:
    payload = json.loads(handle.read())

if not isinstance(payload, dict):
    raise SystemExit(0)

tool_name = payload.get('tool_name')
if not isinstance(tool_name, str):
    raise SystemExit(0)

cwd = payload.get('cwd', os.getcwd())
if not isinstance(cwd, str) or not cwd:
    raise SystemExit(0)

runs_dir = os.path.join(cwd, '.lazyzcode', 'runs')
if not os.path.isdir(runs_dir):
    raise SystemExit(0)

active_run = None
for run_dir in sorted(glob.glob(os.path.join(runs_dir, '*/'))):
    state_file = os.path.join(run_dir, 'state.json')
    try:
        with open(state_file, encoding='utf-8') as state_handle:
            state = json.load(state_handle)
    except FileNotFoundError:
        continue
    except (json.JSONDecodeError, IsADirectoryError, OSError):
        print(json.dumps({'error': 'active_state_unreadable'}), file=sys.stderr)
        continue
    if isinstance(state, dict) and state.get('status') in ('active', 'paused', 'created', 'planning', 'executing', 'blocked', 'verifying', 'reviewing'):
        active_run = run_dir
        break

if active_run is None:
    raise SystemExit(0)

event = {'tool': tool_name, 'timestamp': datetime.datetime.utcnow().isoformat() + 'Z'}
tool_input = payload.get('tool_input')
if not isinstance(tool_input, dict):
    tool_input = {}

changed_file = None
if tool_name in ('Write', 'Edit'):
    file_path = tool_input.get('file_path')
    if isinstance(file_path, str) and file_path:
        event['files'] = [file_path]
        normalized_path = file_path.replace(chr(92), '/')
        if '.lazyzcode/' not in normalized_path and '/.zcode/' not in normalized_path and not normalized_path.endswith('zcode.md') and not normalized_path.endswith('AGENTS.md'):
            event['boundary_warning'] = 'write outside .lazyzcode/ - verify caller is implementer not orchestrator (G-016)'
        # --- AI-slop comment grep on the changed file ---
        if os.path.isfile(file_path):
            slop_markers = re.compile(
                r'(?:AI[- ]generated|generated (?:by|with)[^.\n]{0,40}AI|Co-Authored-By:[^\n]*(?:AI|assistant)|'
                r'AI (?:assistant|agent)[^\n]{0,40}(?:wrote|generated|created)|TODO\s*\(AI\))',
                re.I,
            )
            try:
                with open(file_path, encoding='utf-8', errors='replace') as file_handle:
                    for line_number, line in enumerate(file_handle, 1):
                        if slop_markers.search(line):
                            event['ai_slop_comment'] = f'line {line_number}'
                            print('slop')
                            break
            except OSError:
                pass

try:
    with open(os.path.join(active_run, 'events.jsonl'), 'a', encoding='utf-8') as event_handle:
        event_handle.write(json.dumps(event, default=str) + '\n')
except OSError:
    print(json.dumps({'error': 'events_append_failed'}), file=sys.stderr)
PY
) || SLOP_HIT=""

# --- Delegate to dynamic-rules.sh when present (best-effort, silent) ---
if [ -f "$SCRIPT_DIR/dynamic-rules.sh" ]; then
    bash "$SCRIPT_DIR/dynamic-rules.sh" <"$INPUT_FILE" >/dev/null 2>&1 || true
fi

exit 0
