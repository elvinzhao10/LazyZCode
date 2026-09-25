#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
REPOSITORY_ROOT="${REPOSITORY_ROOT:-}"
if [ -z "$REPOSITORY_ROOT" ]; then
    REPOSITORY_ROOT="$(d="$(cd "$PLUGIN_ROOT/.." && pwd -P)"; \
        while [ "$d" != "/" ]; do [ -d "$d/.github" ] && break; d="$(dirname "$d")"; done; \
        if [ -d "$d/.github" ]; then printf '%s' "$d"; else printf '%s' "$(cd "$PLUGIN_ROOT/.." && pwd -P)"; fi)"
fi
TMP="$(mktemp -d "${TMPDIR:-/tmp}/lazyzcode-ci-suites.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

cp -R "$PLUGIN_ROOT" "$TMP/plugin"
FIXTURE="$TMP/plugin"
CORE_LOG="$TMP/core.log"
REGRESSION_LOG="$TMP/regressions.log"
SENSITIVE_TESTS=(
    v015-readiness-regression.sh
    v016-tooling-lifecycle-regression.sh
    v016-codegraph-regression.sh
    v017-codegraph-fixture-cleanup-regression.sh
    v017-codegraph-install-timeout-regression.sh
    v017-codegraph-lifecycle-caller-survival-regression.sh
    v017-codegraph-uninstall-pid-identity-regression.sh
    v018-verifier-regression.sh
)

for script_name in \
    lazyzcode-plugin-doctor.sh \
    lazyzcode-smoke-test.sh \
    lazyzcode-docs-check.sh \
    lazyzcode-security-check.sh \
    lazyzcode-mcp-test.sh \
    hook-pipeline-test.sh \
    lazyzcode-load-check.sh \
    lazyzcode-contract-check.sh; do
    printf '#!/usr/bin/env bash\nprintf "%%s\\n" "%s" >> "$CORE_LOG"\n' "$script_name" > "$FIXTURE/scripts/$script_name"
    chmod +x "$FIXTURE/scripts/$script_name"
done

while IFS= read -r regression; do
    regression_name="$(basename "$regression")"
    printf '#!/usr/bin/env bash\nprintf "%%s\\n" "%s" >> "$REGRESSION_LOG"\n' "$regression_name" > "$regression"
    chmod +x "$regression"
done < <(find "$FIXTURE/tests" -maxdepth 1 -type f \( -name 'v*-regression.sh' -o -name 'plan-format-compat.test.sh' \) -print)

: > "$CORE_LOG"
: > "$REGRESSION_LOG"
CORE_LOG="$CORE_LOG" REGRESSION_LOG="$REGRESSION_LOG" CLAUDE_PLUGIN_ROOT="$FIXTURE" \
    LAZYZCODE_VERIFY_REGRESSION_DEPTH=0 LAZYZCODE_VERIFY_SUITE=core \
    bash "$FIXTURE/scripts/lazyzcode-verify.sh" > "$TMP/core.json"
python3 - "$TMP/core.json" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding="utf-8"))
assert payload["suite"] == "core"
assert payload["all_pass"] is True
PY
test -s "$CORE_LOG"
grep -Fqx 'plan-format-compat.test.sh' "$REGRESSION_LOG"
for regression_name in "${SENSITIVE_TESTS[@]}"; do
    if grep -Fqx "$regression_name" "$REGRESSION_LOG"; then
        printf 'FAIL core suite ran timing-sensitive lifecycle regression: %s\n' "$regression_name" >&2
        exit 1
    fi
done

: > "$CORE_LOG"
: > "$REGRESSION_LOG"
CORE_LOG="$CORE_LOG" REGRESSION_LOG="$REGRESSION_LOG" CLAUDE_PLUGIN_ROOT="$FIXTURE" \
    LAZYZCODE_VERIFY_REGRESSION_DEPTH=0 LAZYZCODE_VERIFY_SUITE=lifecycle \
    bash "$FIXTURE/scripts/lazyzcode-verify.sh" > "$TMP/lifecycle.json"
python3 - "$TMP/lifecycle.json" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding="utf-8"))
assert payload["suite"] == "lifecycle"
assert payload["all_pass"] is True
PY
test ! -s "$CORE_LOG"
if grep -Fqx 'plan-format-compat.test.sh' "$REGRESSION_LOG"; then
    printf 'FAIL lifecycle suite ran core plan-format regression\n' >&2
    exit 1
fi
for regression_name in "${SENSITIVE_TESTS[@]}"; do
    grep -Fqx "$regression_name" "$REGRESSION_LOG"
done

WORKFLOW="$REPOSITORY_ROOT/.github/workflows/ci.yml"
grep -Eq '^  validate:$' "$WORKFLOW"
grep -Eq '^  supported-floor:$' "$WORKFLOW"
grep -Eq '^  core:$' "$WORKFLOW"
grep -Eq '^  core-current:$' "$WORKFLOW"
grep -Eq '^  lifecycle:$' "$WORKFLOW"
grep -Eq '^  language:$' "$WORKFLOW"
grep -Fq 'needs: [supported-floor, core, core-current, lifecycle, language]' "$WORKFLOW"
grep -Fq 'if: ${{ always() }}' "$WORKFLOW"
grep -Fq 'LAZYZCODE_VERIFY_SUITE: core' "$WORKFLOW"
grep -Fq 'LAZYZCODE_VERIFY_SUITE: lifecycle' "$WORKFLOW"
grep -Fq 'LAZYZCODE_VERIFY_SUITE: language' "$WORKFLOW"
grep -Fq 'LANGUAGE_RESULT: ${{ needs.language.result }}' "$WORKFLOW"
grep -Fq 'test "$LANGUAGE_RESULT" = success' "$WORKFLOW"
grep -Fq 'node-version: "22"' "$WORKFLOW"
grep -Fq 'node-version: "24"' "$WORKFLOW"
grep -Fq 'node-version: "20.0.0"' "$WORKFLOW"
grep -Fq 'node plugins/lazyzcode/scripts/verify-supported-floor.mjs --expected-runtime 20.0.0 --exercise package,install,onboarding,lsp-provider' "$WORKFLOW"
grep -Fq 'SUPPORTED_FLOOR_RESULT: ${{ needs.supported-floor.result }}' "$WORKFLOW"
grep -Fq 'test "$SUPPORTED_FLOOR_RESULT" = success' "$WORKFLOW"
if grep -Fq 'continue-on-error:' "$WORKFLOW"; then
    printf 'FAIL CI must not mask blocking lifecycle failures\n' >&2
    exit 1
fi
grep -Fq 'LAZYZCODE_VERIFY_SUITE: core' "$REPOSITORY_ROOT/.github/workflows/release.yml"
grep -Fq 'LAZYZCODE_VERIFY_SUITE: lifecycle' "$REPOSITORY_ROOT/.github/workflows/release.yml"
grep -Fq 'LAZYZCODE_VERIFY_SUITE: language' "$REPOSITORY_ROOT/.github/workflows/release.yml"
grep -Fq 'needs: [verify, verify-lifecycle, verify-language]' "$REPOSITORY_ROOT/.github/workflows/release.yml"

printf 'PASS CI separates deterministic and lifecycle regression suites\n'
