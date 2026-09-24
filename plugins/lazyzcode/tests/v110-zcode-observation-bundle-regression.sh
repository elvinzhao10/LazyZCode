#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

node --check "$PLUGIN_ROOT/scripts/lazyzcode-zcode-observation.js"
node --check "$PLUGIN_ROOT/scripts/lifecycle/zcode-observation.js"
node --check "$PLUGIN_ROOT/scripts/lifecycle/zcode-observation-contract.js"
node --test \
  "$PLUGIN_ROOT/tests/zcode-observation-bundle.test.js" \
  "$PLUGIN_ROOT/tests/zcode-connector-reference.test.js"
