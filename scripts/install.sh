#!/usr/bin/env bash
# LazyZCode native onboarding (repository root).
#
# Verifies the local package (prerequisites, marketplace layout, load-check,
# plugin doctor), prints the exact ZCode UI steps for the marketplace install,
# and — with --project — additionally runs the durable lifecycle onboard.
#
# Usage:
#   bash scripts/install.sh [--project <abs>] [--install-root <abs>]
#
# Boundaries:
#   - No network calls in the package checks (the optional durable lifecycle
#     onboard with --project fetches the official release by design).
#   - Never edits host configuration; install/enable/update happen through
#     ZCode's own Settings -> Plugin Management UI.
#   - Package readiness only: HOST READINESS stays PENDING until a fresh
#     ZCode session observes one real skill or command plus all six MCP
#     connections.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PLUGIN_DIR="$REPO_ROOT/plugins/lazyzcode"
MARKET_ROOT="$REPO_ROOT/plugins"
SOURCE_URL="https://github.com/elvinzhao10/LazyZCode.git"

info() { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'USAGE'
LazyZCode native onboarding

Usage: bash scripts/install.sh [--project <abs>] [--install-root <abs>]

Options:
  --project <abs>        Also run the durable lifecycle onboard for the given
                         absolute project directory (fetches the official
                         release from the LazyZCode GitHub origin).
  --install-root <abs>   Durable install root for --project (default: the
                         lifecycle's own resolution, e.g.
                         ~/Library/Application Support/LazySeries on macOS).
  -h, --help             Show this help.
USAGE
}

PROJECT=""
INSTALL_ROOT=""
while [ $# -gt 0 ]; do
    case "$1" in
        --project)
            [ $# -ge 2 ] || fail "--project requires an absolute directory argument"
            PROJECT="$2"
            shift 2
            ;;
        --install-root)
            [ $# -ge 2 ] || fail "--install-root requires an absolute directory argument"
            INSTALL_ROOT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "unknown option: $1 (supported: --project <abs>, --install-root <abs>, --help)"
            ;;
    esac
done

case "$PROJECT" in
    "") : ;;
    /*) : ;;
    *) fail "--project must be an absolute path" ;;
esac
case "$INSTALL_ROOT" in
    "") : ;;
    /*) : ;;
    *) fail "--install-root must be an absolute path" ;;
esac

[ -d "$PLUGIN_DIR" ] || fail "plugin directory not found: $PLUGIN_DIR"
[ -f "$REPO_ROOT/plugins/marketplace.json" ] || fail "marketplace manifest not found: $REPO_ROOT/plugins/marketplace.json"
[ -f "$PLUGIN_DIR/.zcode-plugin/plugin.json" ] || fail "plugin manifest not found: $PLUGIN_DIR/.zcode-plugin/plugin.json"

info "=== LazyZCode native onboarding ==="
info "Repository root: $REPO_ROOT"
info "Market root:     $MARKET_ROOT"
info ""

# --- Prerequisites -----------------------------------------------------------
info "--- Prerequisites ---"

if ! command -v node >/dev/null 2>&1; then
    fail "Node.js is required on PATH. Install Node.js LTS 24 (recommended) or 22 (supported; LTS 20 accepted for compatibility), then rerun."
fi
NODE_VERSION="$(node --version)"
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
case "$NODE_MAJOR" in
    ''|*[!0-9]*) fail "cannot parse the Node.js version output: $NODE_VERSION" ;;
esac
if [ "$NODE_MAJOR" -lt 20 ]; then
    fail "Node.js LTS 20+ is required (found $NODE_VERSION). Install Node.js LTS 24 (recommended) or 22, then rerun."
fi
if [ "$NODE_MAJOR" -eq 24 ]; then
    info "Node.js $NODE_VERSION (recommended LTS line)"
elif [ "$NODE_MAJOR" -eq 20 ] || [ "$NODE_MAJOR" -eq 22 ]; then
    info "Node.js $NODE_VERSION (supported; Node.js LTS 24 is recommended)"
else
    info "Node.js $NODE_VERSION (accepted; Node.js LTS 24 is recommended)"
fi

command -v git >/dev/null 2>&1 || fail "Git is required on PATH. Install Git, then rerun."
GIT_VERSION="$(git --version)"
info "$GIT_VERSION"
info ""

# --- Marketplace layout (in-repo, no network) --------------------------------
info "--- Marketplace layout ---"

node -e '
const fs = require("node:fs");
const [, marketplacePath, manifestPath] = process.argv;
let marketplace;
let manifest;
try {
    marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
} catch (error) {
    console.error(`marketplace.json does not parse as JSON: ${error.message}`);
    process.exit(1);
}
try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
    console.error(`plugin.json does not parse as JSON: ${error.message}`);
    process.exit(1);
}
const entries = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
if (entries.length !== 1) {
    console.error(`marketplace.json must declare exactly one plugin entry (found ${entries.length})`);
    process.exit(1);
}
const entry = entries[0];
if (entry.name !== "lazyzcode") {
    console.error(`marketplace.json entry name must be "lazyzcode" (found ${JSON.stringify(entry.name)})`);
    process.exit(1);
}
if (manifest.name !== "lazyzcode") {
    console.error(`plugin.json name must be "lazyzcode" (found ${JSON.stringify(manifest.name)})`);
    process.exit(1);
}
if (entry.version !== manifest.version) {
    console.error(`version mismatch: marketplace.json ${JSON.stringify(entry.version)} != plugin.json ${JSON.stringify(manifest.version)}`);
    process.exit(1);
}
console.log(`marketplace entry: lazyzcode@${entry.version} (matches plugin manifest)`);
' "$REPO_ROOT/plugins/marketplace.json" "$PLUGIN_DIR/.zcode-plugin/plugin.json"

info ""

# --- Package readiness: load-check -------------------------------------------
info "--- Package readiness (lazyzcode-load-check.sh) ---"

LOAD_CHECK_STATUS=0
LOAD_CHECK_OUTPUT="$(bash "$PLUGIN_DIR/scripts/lazyzcode-load-check.sh" 2>&1)" || LOAD_CHECK_STATUS=$?
printf '%s\n' "$LOAD_CHECK_OUTPUT"
if [ "$LOAD_CHECK_STATUS" -ne 0 ] || ! printf '%s\n' "$LOAD_CHECK_OUTPUT" | grep -q '^PACKAGE_READINESS=full$'; then
    fail "load-check did not report PACKAGE_READINESS=full (exit $LOAD_CHECK_STATUS). Package readiness failed loudly; correct the named package file and rerun scripts/install.sh."
fi
info ""

# --- Package health: plugin doctor (host=package) ----------------------------
info "--- Plugin doctor (host=package) ---"

DOCTOR_STATUS=0
DOCTOR_OUTPUT="$(bash "$PLUGIN_DIR/scripts/lazyzcode-plugin-doctor.sh" 2>&1)" || DOCTOR_STATUS=$?
printf '%s\n' "$DOCTOR_OUTPUT"
if [ "$DOCTOR_STATUS" -ne 0 ]; then
    fail "plugin doctor failed (exit $DOCTOR_STATUS). Package readiness failed loudly; correct the named check and rerun scripts/install.sh."
fi
info ""

# --- ZCode UI handoff ---------------------------------------------------------
info "--- Install through ZCode (Settings -> Plugin Management) ---"
info ""
info "ZCode installs plugins only through its own UI. Use the ABSOLUTE market"
info "root directory below (the folder containing marketplace.json):"
info ""
info "    $MARKET_ROOT"
info ""
CLIPBOARD_NOTE=""
if [ "$(uname -s)" = "Darwin" ] && command -v pbcopy >/dev/null 2>&1; then
    # Best-effort clipboard copy; a pbcopy failure never fails onboarding.
    if printf '%s' "$MARKET_ROOT" | pbcopy >/dev/null 2>&1; then
        CLIPBOARD_NOTE=" (copied to the clipboard)"
    fi
fi
info "Steps:"
info "  1. Open ZCode -> Settings -> Plugin Management -> Discover tab."
info "  2. Click \"+ / Add Plugin Marketplace\" and paste the market root"
info "     directory above${CLIPBOARD_NOTE}."
info "  3. Open the Personal tab, find the lazyzcode plugin card, and click"
info "     Install. Installed plugins are enabled by default."
info "  4. Start a fresh session and verify: one real skill via the Skill tool,"
info "     one command as a slash menu entry, and all six MCP connections."
info ""

# --- Optional development-only CLI validation --------------------------------
info "--- Optional: ZCode CLI package validation (development-only) ---"

if command -v zcode >/dev/null 2>&1; then
    ZCODE_VALIDATE_STATUS=0
    ZCODE_VALIDATE_OUTPUT="$(cd "$REPO_ROOT" && zcode plugins validate plugins/lazyzcode 2>&1)" || ZCODE_VALIDATE_STATUS=$?
    printf '%s\n' "$ZCODE_VALIDATE_OUTPUT"
    if [ "$ZCODE_VALIDATE_STATUS" -ne 0 ]; then
        info "NOTE: 'zcode plugins validate' exited $ZCODE_VALIDATE_STATUS. This development-only check is best-effort; its absence or failure is not an install and not host proof. Continuing."
    fi
else
    info "No 'zcode' binary on PATH; skipping the optional package validation."
    info "(Normal on end-user machines — the CLI is not required to install.)"
fi
info ""

# --- Optional durable lifecycle onboard --------------------------------------
if [ -n "$PROJECT" ]; then
    [ -d "$PROJECT" ] || fail "--project directory does not exist: $PROJECT"
    info "--- Durable lifecycle onboard (launcher route) ---"
    info "Fetches the official release from $SOURCE_URL (the only network step; the package checks above stayed offline)."
    DEFAULT_INSTALL_ROOT="$(node -e 'try { process.stdout.write(require(process.argv[1]).resolveInstallRoot({})); } catch { }' "$PLUGIN_DIR/scripts/lifecycle/index.js" 2>/dev/null || true)"
    if [ -n "$INSTALL_ROOT" ]; then
        info "Install root: $INSTALL_ROOT (explicit)"
    elif [ -n "$DEFAULT_INSTALL_ROOT" ]; then
        info "Install root: $DEFAULT_INSTALL_ROOT (lifecycle default)"
    fi
    LIFECYCLE_ARGS=(onboard --source "$SOURCE_URL" --project "$PROJECT")
    if [ -n "$INSTALL_ROOT" ]; then
        LIFECYCLE_ARGS+=(--install-root "$INSTALL_ROOT")
    fi
    LIFECYCLE_STATUS=0
    LIFECYCLE_OUTPUT="$(node "$PLUGIN_DIR/scripts/lazyzcode-lifecycle.js" "${LIFECYCLE_ARGS[@]}" --json 2>&1)" || LIFECYCLE_STATUS=$?
    printf '%s\n' "$LIFECYCLE_OUTPUT"
    if [ "$LIFECYCLE_STATUS" -ne 0 ]; then
        info ""
        fail "durable lifecycle onboard failed (exit $LIFECYCLE_STATUS). The lifecycle error above is authoritative. Package checks already passed, but the durable install did not complete and host readiness is NOT claimed."
    fi
    info "Next (durable route): node \"<install-root>/LazyZCode/launcher.js\" status"
    info ""
fi

# --- Readiness discipline ----------------------------------------------------
info "=== Readiness discipline ==="
info "PACKAGE READINESS: full"
info "HOST READINESS: PENDING — until a fresh ZCode session observes one real"
info "skill or command plus all six MCP connections, host readiness remains"
info "pending. Package checks never prove host activation."
