#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="$(cd "$PLUGIN_ROOT/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/lazyzcode-readiness.XXXXXX")"
PASS=0
FAIL=0

cleanup() {
    rm -rf "$TMP"
}

trap cleanup EXIT

pass() {
    echo "PASS $1"
    PASS=$((PASS + 1))
}

fail() {
    echo "FAIL $1" >&2
    FAIL=$((FAIL + 1))
}

expect_status() {
    local label="$1"
    local expected="$2"
    shift 2
    local output status
    if output=$("$@" 2>&1); then
        status=0
    else
        status=$?
    fi
    printf '%s\n' "$output" > "$TMP/${label}.out"
    if [ "$status" -ne "$expected" ]; then
        fail "$label (exit $status, expected $expected):"
        tail -n 40 "$TMP/${label}.out" >&2
        return
    fi
    pass "$label"
}

expect_contains() {
    local label="$1"
    local pattern="$2"
    if grep -qE "$pattern" "$TMP/${label}.out"; then
        pass "$label output"
    else
        fail "$label missing '$pattern'"
    fi
}

mkdir -p "$TMP/plugins"
cp "$PROJECT_ROOT/marketplace.json" "$TMP/plugins/marketplace.json"
cp -R "$PLUGIN_ROOT" "$TMP/plugins/lazyzcode"
INSTALLED_PLUGIN="$(cd "$TMP/plugins/lazyzcode" && pwd)"

expect_status full-package-readiness 0 env CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-load-check.sh"
expect_contains full-package-readiness '^PACKAGE_READINESS=full$'
expect_contains full-package-readiness '^PASS commands: 20/20$'
expect_contains full-package-readiness '^PASS MCP servers: 6/6$'
expect_status full-package-doctor 0 env CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-plugin-doctor.sh"
expect_contains full-package-doctor '^  \[PASS\] Command definitions \(20\)$'

expect_status self-contained-package-contract 0 python3 - "$INSTALLED_PLUGIN" <<'PY'
import json
import os
from pathlib import Path
import sys

root = Path(sys.argv[1])
assert (root / "LICENSE").is_file()
assert (root / "NOTICE").is_file()
with open(os.path.join(root, ".mcp.json"), encoding="utf-8") as handle:
    servers = json.load(handle)["mcpServers"]

expected_servers = {
    "run-ledger",
    "verification",
    "status-dashboard",
    "context-graph",
    "code-intel",
    "docs",
}
assert set(servers) == expected_servers, sorted(servers)
assert not os.path.exists(os.path.join(root, "commands", "zcode-parity-report.md"))
assert not os.path.exists(os.path.join(root, "mcp", "parity"))
assert not os.path.exists(os.path.join(root, "mcp", "source-map"))
mcp_test = (root / "scripts" / "lazyzcode-mcp-test.sh").read_text(encoding="utf-8")
assert "MCP integration test (6 declared servers + optional LSP endpoint)" in mcp_test
assert "for server in run-ledger verification status-dashboard context-graph code-intel docs lsp; do" in mcp_test
PY

expect_status operational-mcp-reference-inventory 0 python3 - "$INSTALLED_PLUGIN" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
operational_sources = (
    "mcp/code-intel/server.py",
    "mcp/context-graph/server.py",
    "mcp/docs/server.py",
)
for relative_path in operational_sources:
    source = (root / relative_path).read_text(encoding="utf-8").lower()
    assert "lazycodex" not in source, relative_path
    assert "omo" not in source, relative_path

# NOTICE is package-local legal attribution and the checker intentionally keeps
# policy deny-list patterns.
assert "lazycodex" in (root / "NOTICE").read_text(encoding="utf-8").lower()
policy_source = (root / "scripts/lazyzcode-docs-check.sh").read_text(encoding="utf-8").lower()
assert "lazycodex" in policy_source
assert "omo" in policy_source
PY

expect_status documentation-boundary-inventory 0 python3 - "$INSTALLED_PLUGIN" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])

assert (root / "docs" / "verification-matrix.md").is_file(), "copied plugin must retain package-owned docs"
for relative_path in (
    "scripts/lazyzcode-load-check.sh",
    "scripts/lazyzcode-plugin-doctor.sh",
    "scripts/lazyzcode-mcp-test.sh",
):
    source = (root / relative_path).read_text(encoding="utf-8")
    assert "../docs" not in source, relative_path
    assert "docs/handoff.md" not in source, relative_path
PY

PARENT_COPY="$TMP/poisoned-parent/plugins/lazyzcode"
mkdir -p "$TMP/poisoned-parent/docs"
printf '[poisoned parent handoff](missing.md)\n' > "$TMP/poisoned-parent/docs/handoff.md"
mkdir -p "$TMP/poisoned-parent/plugins"
cp "$PROJECT_ROOT/marketplace.json" "$TMP/poisoned-parent/plugins/marketplace.json"
cp -R "$PLUGIN_ROOT" "$PARENT_COPY"
expect_status copied-plugin-load-ignores-parent-docs 0 env CLAUDE_PLUGIN_ROOT="$PARENT_COPY" bash "$PARENT_COPY/scripts/lazyzcode-load-check.sh"
expect_contains copied-plugin-load-ignores-parent-docs '^PACKAGE_READINESS=full$'
expect_status copied-plugin-docs-ignores-parent-docs 0 env CLAUDE_PLUGIN_ROOT="$PARENT_COPY" bash "$PARENT_COPY/scripts/lazyzcode-docs-check.sh"
expect_contains copied-plugin-docs-ignores-parent-docs '"broken":0'
expect_status copied-plugin-doctor-ignores-parent-docs 0 env CLAUDE_PLUGIN_ROOT="$PARENT_COPY" bash "$PARENT_COPY/scripts/lazyzcode-plugin-doctor.sh"
expect_contains copied-plugin-doctor-ignores-parent-docs '^  \[PASS\] Command definitions \(20\)$'

printf '{invalid json\n' > "$INSTALLED_PLUGIN/.zcode-plugin/plugin.json"
expect_status invalid-zcode-manifest 1 env CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-load-check.sh"
expect_contains invalid-zcode-manifest '^FAIL plugin manifest: invalid JSON'
expect_status doctor-catches-invalid-zcode-manifest 1 env CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-plugin-doctor.sh"
expect_contains doctor-catches-invalid-zcode-manifest 'Plugin manifest is valid JSON'

cp "$PLUGIN_ROOT/.zcode-plugin/plugin.json" "$INSTALLED_PLUGIN/.zcode-plugin/plugin.json"
printf '{invalid json\n' > "$INSTALLED_PLUGIN/.zcode-plugin/plugin.json"
expect_status doctor-catches-validator-failure 1 env CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-plugin-doctor.sh"
if command -v zcode >/dev/null 2>&1; then
    expect_contains doctor-catches-validator-failure 'ZCode CLI manifest validator'
fi
cp "$PLUGIN_ROOT/.zcode-plugin/plugin.json" "$INSTALLED_PLUGIN/.zcode-plugin/plugin.json"

python3 - "$INSTALLED_PLUGIN/.zcode-plugin/plugin.json" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    manifest = json.load(handle)
del manifest["name"]
with open(path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle)
PY
expect_status doctor-catches-validator-text-failure 1 env CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-plugin-doctor.sh"
expect_contains doctor-catches-validator-text-failure 'ZCode CLI manifest validator'
cp "$PLUGIN_ROOT/.zcode-plugin/plugin.json" "$INSTALLED_PLUGIN/.zcode-plugin/plugin.json"

mkdir -p "$TMP/fake-zcode"
printf '%s\n' '#!/usr/bin/env bash' 'printf "%s\\n" "Request failed with status code 500"' 'exit 0' > "$TMP/fake-zcode/zcode"
chmod +x "$TMP/fake-zcode/zcode"
expect_status doctor-catches-validator-exit-zero-server-error 1 env PATH="$TMP/fake-zcode:$PATH" CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-plugin-doctor.sh" --host-validator "$TMP/fake-zcode/zcode"
expect_contains doctor-catches-validator-exit-zero-server-error 'ZCode CLI manifest validator'

printf '%s\n' '#!/usr/bin/env bash' 'printf "%s\\n" "Validation successful: 0 errors"' 'exit 0' > "$TMP/fake-zcode/zcode"
expect_status doctor-accepts-validator-zero-errors 0 env PATH="$TMP/fake-zcode:$PATH" CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-plugin-doctor.sh" --host-validator "$TMP/fake-zcode/zcode"
expect_contains doctor-accepts-validator-zero-errors '^  \[PASS\] ZCode CLI manifest validator$'

printf '%s\n' '#!/usr/bin/env bash' 'printf "%s\\n" "Validation passed with no errors"' 'exit 0' > "$TMP/fake-zcode/zcode"
expect_status doctor-accepts-validator-no-errors 0 env PATH="$TMP/fake-zcode:$PATH" CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-plugin-doctor.sh" --host-validator "$TMP/fake-zcode/zcode"
expect_contains doctor-accepts-validator-no-errors '^  \[PASS\] ZCode CLI manifest validator$'

printf '%s\n' '{"plugins":[{"name":"lazyzcode","version":"0.0.0"}]}' > "$TMP/mismatched-marketplace.json"
expect_status mismatched-marketplace-version 1 env LAZYZCODE_MARKETPLACE_FILE="$TMP/mismatched-marketplace.json" bash "$PLUGIN_ROOT/scripts/lazyzcode-load-check.sh"
expect_contains mismatched-marketplace-version '^FAIL marketplace version agreement:'

mkdir -p "$TMP/manual-root/manual-skills/skills/lazy-zcode-manual"
printf '%s\n' '---' 'name: lazy-zcode-manual' '---' '# manual' > "$TMP/manual-root/manual-skills/skills/lazy-zcode-manual/SKILL.md"
expect_status manual-skill-only-readiness 0 env CLAUDE_PLUGIN_ROOT="$TMP/manual-root/manual-skills" bash "$PLUGIN_ROOT/scripts/lazyzcode-load-check.sh"
expect_contains manual-skill-only-readiness '^PACKAGE_READINESS=degraded$'
expect_contains manual-skill-only-readiness '^UNCHECKED commands/hooks/MCP:'
if grep -Fq 'FAIL package ' "$TMP/manual-skill-only-readiness.out"; then
    fail "manual-skill-only-readiness must not report package legal failures"
else
    pass "manual-skill-only-readiness omits unavailable package legal checks"
fi

rm -rf "$TMP/plugins/lazyzcode"
cp -R "$PLUGIN_ROOT" "$TMP/plugins/lazyzcode"
INSTALLED_PLUGIN="$(cd "$TMP/plugins/lazyzcode" && pwd)"
expect_status installed-root-mcp 0 env CWD="$PROJECT_ROOT" CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" bash "$INSTALLED_PLUGIN/scripts/lazyzcode-mcp-test.sh"
expect_contains installed-root-mcp "Plugin root: $INSTALLED_PLUGIN"
expect_contains installed-root-mcp '^=== LazyZCode MCP integration test \(6 declared servers \+ optional LSP endpoint\) ===$'
expect_contains installed-root-mcp '^Failed: 0$'
expect_contains installed-root-mcp '^MCP test: ALL PASS$'
expect_status installed-root-master-verify 0 env CWD="$PROJECT_ROOT" CLAUDE_PLUGIN_ROOT="$INSTALLED_PLUGIN" LAZYZCODE_VERIFY_REGRESSION_DEPTH=1 bash "$INSTALLED_PLUGIN/scripts/lazyzcode-verify.sh"
expect_contains installed-root-master-verify '"all_pass":true'
expect_contains installed-root-master-verify '"regression_inventory":"pass"'
expect_contains installed-root-master-verify '"automatic_tooling_regressions":"skipped-nested"'

cp -R "$PLUGIN_ROOT" "$TMP/directory-link-plugin"
printf '%s\n' '[docs directory](docs/)' >> "$TMP/directory-link-plugin/README.md"
expect_status package-docs-directory-link 0 env CLAUDE_PLUGIN_ROOT="$TMP/directory-link-plugin" bash "$TMP/directory-link-plugin/scripts/lazyzcode-docs-check.sh"
expect_contains package-docs-directory-link '"broken":0'

for link_case in empty missing escape; do
    cp -R "$PLUGIN_ROOT" "$TMP/$link_case-link-plugin"
    case "$link_case" in
        empty) markdown='[empty]()'; expected='empty link target' ;;
        missing) markdown='[missing](missing.md)'; expected='target not found' ;;
        escape) markdown='[escape](../outside.md)'; expected='target escapes plugin root' ;;
    esac
    printf '%s\n' "$markdown" >> "$TMP/$link_case-link-plugin/README.md"
    expect_status "package-docs-$link_case-link" 1 env CLAUDE_PLUGIN_ROOT="$TMP/$link_case-link-plugin" bash "$TMP/$link_case-link-plugin/scripts/lazyzcode-docs-check.sh"
    expect_contains "package-docs-$link_case-link" "$expected"
done

expect_status missing-plugin-root-pipeline 1 env CWD="$TMP/workspace" CLAUDE_PLUGIN_ROOT="$TMP/missing-plugin" bash "$PLUGIN_ROOT/scripts/hook-pipeline-test.sh"
expect_contains missing-plugin-root-pipeline 'plugin root is missing'

cp -R "$PLUGIN_ROOT" "$TMP/broken-hook-plugin"
printf '%s\n' '#!/usr/bin/env bash' 'exit 9' > "$TMP/broken-hook-plugin/scripts/hooks/user-prompt-submit.sh"
chmod +x "$TMP/broken-hook-plugin/scripts/hooks/user-prompt-submit.sh"
expect_status hook-exit-propagates 1 env CWD="$TMP/workspace" CLAUDE_PLUGIN_ROOT="$TMP/broken-hook-plugin" bash "$TMP/broken-hook-plugin/scripts/hook-pipeline-test.sh"
expect_contains hook-exit-propagates 'UserPromptSubmit \(plain\) — exited 9'

cp -R "$PLUGIN_ROOT" "$TMP/noisy-hook-plugin"
printf '%s\n' '#!/usr/bin/env bash' 'printf "%s\\n" noisy-hook-output' > "$TMP/noisy-hook-plugin/scripts/hooks/user-prompt-submit.sh"
chmod +x "$TMP/noisy-hook-plugin/scripts/hooks/user-prompt-submit.sh"
expect_status hook-empty-output-propagates 1 env CWD="$TMP/workspace" CLAUDE_PLUGIN_ROOT="$TMP/noisy-hook-plugin" bash "$TMP/noisy-hook-plugin/scripts/hook-pipeline-test.sh"
expect_contains hook-empty-output-propagates 'UserPromptSubmit \(plain\) — expected empty stdout, got: noisy-hook-output'

printf '{invalid json\n' > "$INSTALLED_PLUGIN/.zcode-plugin/plugin.json"
mkdir -p "$TMP/workspace"
expect_status failed-session-start 0 bash -c "printf '%s\\n' '{\"event\":\"session_start\",\"cwd\":\"$TMP/workspace\"}' | CLAUDE_PLUGIN_ROOT='$INSTALLED_PLUGIN' bash '$INSTALLED_PLUGIN/scripts/hooks/session-start.sh'"
expect_contains failed-session-start 'SESSIONSTART_READINESS=degraded reason=package-readiness-failed'

echo "Passed: $PASS"
echo "Failed: $FAIL"
[ "$FAIL" -eq 0 ]
