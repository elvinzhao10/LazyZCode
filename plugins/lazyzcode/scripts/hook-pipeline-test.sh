#!/usr/bin/env bash
# hook-pipeline-test.sh — Simulates ZCode's seven-event hook lifecycle by piping
# realistic payloads (from tests/fixtures/hook-events/) through each hook in
# sequence. Proves the entire hook chain works end-to-end without requiring a
# live ZCode session.
#
# ZCode output contract under test:
#   - SessionStart / UserPromptSubmit / Stop print strict JSON
#     ({"additionalContext": "..."}) or NOTHING on stdout, exit 0.
#   - PreToolUse denies with exit code 2 and a stderr reason; otherwise prints
#     NOTHING and exits 0.
#   - PostToolUse / PostToolUseFailure print NOTHING, exit 0.
#   - PermissionRequest (lifecycle-event.js) prints NOTHING, exit 0, and
#     appends a normalized record under .lazyzcode/hook-events/.
#
# Usage: bash hook-pipeline-test.sh
set -uo pipefail

CWD="${CWD:-$(pwd)}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
FIXTURES="$PLUGIN_ROOT/tests/fixtures/hook-events"
if [ ! -d "$PLUGIN_ROOT" ]; then
    echo "Hook pipeline test: FAIL (plugin root is missing: $PLUGIN_ROOT)" >&2
    exit 1
fi
HOOKS_DIR="$PLUGIN_ROOT/scripts/hooks"
if [ ! -d "$HOOKS_DIR" ] || [ ! -d "$FIXTURES" ]; then
    echo "Hook pipeline test: FAIL (hooks dir or fixtures dir missing)" >&2
    exit 1
fi
# Finite budget shared with the release verifier (lazyzcode-verify.sh exports
# the same variable). Each hook invocation runs under an alarm so a hung hook
# cannot stall the suite; the alarm wrapper preserves stdout/stderr/exit code.
HOOK_TIMEOUT="${LAZYZCODE_VERIFY_TIMEOUT_SECONDS:-90}"
run_hook() {
    perl -e 'alarm shift; exec @ARGV or exit 127' "$HOOK_TIMEOUT" "$@"
}
export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
SESSION_ID="hook-pipeline-test-$$"
PASS=0
FAIL=0
RESULTS=""

payload() {
    # payload <Event>.json — substitute the ${PROJECT_DIR} placeholder.
    sed "s|\${PROJECT_DIR}|$CWD|g" "$FIXTURES/$1"
}

report() {
    # report <name> <pass|fail> <detail>
    if [ "$2" = "pass" ]; then
        RESULTS="${RESULTS}  [PASS] $1 — $3\n"
        PASS=$((PASS + 1))
    else
        RESULTS="${RESULTS}  [FAIL] $1 — $3\n"
        FAIL=$((FAIL + 1))
    fi
}

# expect_stdout <name> <hook> <fixture> <pattern|-> <expected_exit>
expect_stdout() {
    local name="$1" hook="$2" fixture_file="$3" pattern="$4" expected_exit="$5"
    local out err status
    out=$(payload "$fixture_file" | run_hook bash "$HOOKS_DIR/$hook" 2>/tmp/lazyzcode-hpt-err.$$)
    status=$?
    err=$(cat /tmp/lazyzcode-hpt-err.$$ 2>/dev/null)
    rm -f /tmp/lazyzcode-hpt-err.$$
    if [ "$status" -ne "$expected_exit" ]; then
        report "$name" fail "exited $status (expected $expected_exit): ${err:0:80}"
    elif [ "$pattern" = "-" ]; then
        if [ -z "$out" ]; then
            report "$name" pass "silent stdout as expected (exit $status)"
        else
            report "$name" fail "expected empty stdout, got: ${out:0:80}"
        fi
    elif printf '%s' "$out" | grep -Eq "$pattern"; then
        report "$name" pass "stdout matched /$pattern/ (exit $status)"
    else
        report "$name" fail "expected stdout /$pattern/, got: ${out:0:80}"
    fi
}

# expect_deny <name> <hook> <fixture> — PreToolUse deny: exit 2, empty stdout, stderr reason.
expect_deny() {
    local name="$1" hook="$2" fixture_file="$3" payload
    payload=$(payload "$fixture_file" | sed "s|\"command\":\"ls -la\"|\"command\":\"rm -rf /\"|")
    local out err status
    out=$(printf '%s' "$payload" | run_hook bash "$HOOKS_DIR/$hook" 2>/tmp/lazyzcode-hpt-err.$$)
    status=$?
    err=$(cat /tmp/lazyzcode-hpt-err.$$ 2>/dev/null)
    rm -f /tmp/lazyzcode-hpt-err.$$
    if [ "$status" -ne 2 ]; then
        report "$name" fail "deny must exit 2, got $status"
    elif [ -n "$out" ]; then
        report "$name" fail "deny must keep stdout empty, got: ${out:0:80}"
    elif ! printf '%s' "$err" | grep -Eqi 'denial|denied'; then
        report "$name" fail "deny must explain the reason on stderr, got: ${err:0:80}"
    else
        report "$name" pass "denied with exit 2 and stderr reason"
    fi
}

echo "=== LazyZCode Hook Pipeline Activation Test (ZCode 7-event surface) ==="
echo "Simulating the ZCode hook lifecycle with realistic payloads..."
echo ""

# 1. SessionStart — bootstraps state and reports readiness via additionalContext.
expect_stdout "SessionStart" "session-start.sh" "SessionStart.json" \
    'additionalContext.*(SESSIONSTART_READINESS|LazyZCode)' 0

# 2. UserPromptSubmit — plain prompt without keywords or adaptive machinery output: silent.
expect_stdout "UserPromptSubmit (plain)" "user-prompt-submit.sh" "UserPromptSubmit.json" "-" 0

# 3. UserPromptSubmit — command keyword routes to the explicit entry command.
KW_PAYLOAD='{"session_id":"'"$SESSION_ID"'","cwd":"'"$CWD"'","hook_event_name":"UserPromptSubmit","prompt":"run ultrawork on the auth flow"}'
out=$(printf '%s' "$KW_PAYLOAD" | run_hook bash "$HOOKS_DIR/user-prompt-submit.sh" 2>/dev/null); status=$?
if [ "$status" -eq 0 ] && printf '%s' "$out" | grep -Eq 'additionalContext.*(/lazy-ultrawork|ultrawork)'; then
    report "UserPromptSubmit (keyword)" pass "routed keyword to /lazy-ultrawork (exit 0)"
else
    report "UserPromptSubmit (keyword)" fail "expected keyword routing, got: ${out:0:80}"
fi

# 4. UserPromptSubmit — context-pressure marker triggers the recovery directive (no PreCompact in ZCode).
CP_PAYLOAD='{"session_id":"'"$SESSION_ID"'","cwd":"'"$CWD"'","hook_event_name":"UserPromptSubmit","prompt":"context compacted; continue the plan"}'
out=$(printf '%s' "$CP_PAYLOAD" | run_hook bash "$HOOKS_DIR/user-prompt-submit.sh" 2>/dev/null); status=$?
if [ "$status" -eq 0 ] && printf '%s' "$out" | grep -Eqi 'additionalContext.*(context pressure|recover)'; then
    report "UserPromptSubmit (context pressure)" pass "injected recovery directive (exit 0)"
else
    report "UserPromptSubmit (context pressure)" fail "expected recovery directive, got: ${out:0:80}"
fi

# 5. PreToolUse — safe command: silent allow.
expect_stdout "PreToolUse (allow)" "pre-tool-use.sh" "PreToolUse.json" "-" 0

# 6. PreToolUse — destructive delete: deny via exit 2 + stderr.
expect_deny "PreToolUse (deny rm -rf /)" "pre-tool-use.sh" "PreToolUse.json"

# 7. PostToolUse — silent ledger update (no active run here).
expect_stdout "PostToolUse" "post-tool-use.sh" "PostToolUse.json" "-" 0

# 8. PostToolUseFailure — silent failure classification.
expect_stdout "PostToolUseFailure" "post-tool-use-failure.sh" "PostToolUseFailure.json" "-" 0

# 9. PermissionRequest — advisory audit consumer: silent, exit 0, record persisted.
RECORDS_BEFORE=$(find "$CWD/.lazyzcode/hook-events" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
out=$(payload "PermissionRequest.json" | node "$HOOKS_DIR/lifecycle-event.js" 2>/tmp/lazyzcode-hpt-err.$$); status=$?
err=$(cat /tmp/lazyzcode-hpt-err.$$ 2>/dev/null)
rm -f /tmp/lazyzcode-hpt-err.$$
if [ "$status" -ne 0 ]; then
    report "PermissionRequest" fail "exited $status (expected 0): ${err:0:80}"
elif [ -n "$out" ]; then
    report "PermissionRequest" fail "expected empty stdout, got: ${out:0:80}"
else
    report "PermissionRequest" pass "silent stdout as expected (exit 0)"
fi
RECORDS_AFTER=$(find "$CWD/.lazyzcode/hook-events" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
if [ "$RECORDS_AFTER" -gt "$RECORDS_BEFORE" ]; then
    report "PermissionRequest (ledger)" pass "normalized record appended to .lazyzcode/hook-events/"
else
    report "PermissionRequest (ledger)" fail "expected a persisted hook-event record"
fi

# 10. Stop — no active run: silent allow.
expect_stdout "Stop (no active run)" "stop-gate.sh" "Stop.json" "-" 0

# 11. Stop — context pressure passes through gracefully.
CP_STOP='{"session_id":"'"$SESSION_ID"'","cwd":"'"$CWD"'","hook_event_name":"Stop","stop_hook_active":false,"prompt":"context compacted"}'
out=$(printf '%s' "$CP_STOP" | run_hook bash "$HOOKS_DIR/stop-gate.sh" 2>/dev/null); status=$?
if [ "$status" -eq 0 ] && [ -z "$out" ]; then
    report "Stop (context pressure)" pass "passed through gracefully (exit 0)"
else
    report "Stop (context pressure)" fail "expected silent pass-through, got: ${out:0:80}"
fi

printf '%b' "$RESULTS"
echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "Hook pipeline test: ALL PASS"
    echo ""
    echo "All 7 ZCode shell hook events produce correct output for realistic payloads."
    echo "Package-level hook behavior passed; live host registration remains unchecked."
    exit 0
else
    echo "Hook pipeline test: $FAIL FAILURES"
    exit 1
fi
