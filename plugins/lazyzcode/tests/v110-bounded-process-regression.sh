#!/usr/bin/env bash
# v110 bounded-process regression: drives the three bounded regression
# programs against their shipped process-supervision runners.
set -euo pipefail

PLUGIN_ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
if [ -d /private/tmp ]; then
  export TMPDIR=/private/tmp
else
  export TMPDIR="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
fi
TMP=$(mktemp -d "$TMPDIR/lazyzcode-bounded-process.XXXXXX")
cleanup() {
  local rc=$?
  if [ "${PRESERVE_BOUNDED_TMP:-0}" = 1 ]; then
    printf 'PRESERVED_TMP: %s\n' "$TMP" >&2
  else
    rm -rf "$TMP"
  fi
  exit "$rc"
}
trap cleanup EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$1"; }

PYTHON="${LAZYZCODE_PYTHON:-python3.12}"
command -v "$PYTHON" > /dev/null 2>&1 || PYTHON=python3

mkdir -p "$TMP/project with spaces"
git -C "$TMP/project with spaces" init -q
git -C "$TMP/project with spaces" config user.email test@example.invalid
git -C "$TMP/project with spaces" config user.name Test
printf 'fixture\n' > "$TMP/project with spaces/tracked.txt"
printf '.lazyzcode/\n' > "$TMP/project with spaces/.gitignore"
git -C "$TMP/project with spaces" add tracked.txt
git -C "$TMP/project with spaces" add .gitignore
git -C "$TMP/project with spaces" commit -qm fixture

"$PYTHON" "$PLUGIN_ROOT/tests/bounded-lifecycle-state-machine-regression.py" \
  "$PLUGIN_ROOT/scripts/lazyzcode_process_lifecycle.py"
pass 'typed lifecycle decisions fail closed for inspection, identity, survivor and signal outcomes'

"$PYTHON" "$PLUGIN_ROOT/tests/bounded-launch-supervisor-regression.py" \
  "$PLUGIN_ROOT/scripts/lazyzcode_launch_supervisor.py"
pass 'bounded launch supervisor publishes atomic status and requires verified group teardown'

"$PYTHON" "$PLUGIN_ROOT/tests/bounded-supervisor-fault-regression.py" \
  "$PLUGIN_ROOT/scripts/lazyzcode-bounded-run.py"
pass 'supervisor inspection faults remain typed and teardown-safe at every lifecycle phase'
