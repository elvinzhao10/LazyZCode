#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateInstalledMarketplacePackage, validateMarketplaceRoutes } = require('./lifecycle/marketplace-routes');

// Release root = the repository root that contains plugins/marketplace.json
// and plugins/lazyzcode/. Defaults to three levels above this script; without
// release metadata the checker validates the installed package boundary itself.
const hasExplicitReleaseRoot = process.argv[2] !== undefined;
const releaseRoot = hasExplicitReleaseRoot ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', '..', '..');
try {
  const result = hasExplicitReleaseRoot
    ? validateMarketplaceRoutes(releaseRoot)
    : fs.existsSync(path.join(releaseRoot, 'plugins', 'lazyzcode'))
      ? validateMarketplaceRoutes(releaseRoot)
      : validateInstalledMarketplacePackage(path.resolve(__dirname, '..'));
  process.stdout.write(`${JSON.stringify({
    status: 'pass',
    version: result.version,
    marketplace: result.marketplace_name,
    plugin: result.plugin,
    install_id: result.install_id,
    payload_files: result.payload_inventory.length,
  })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.code || 'MARKETPLACE_ROUTE_INVALID', message: error.message })}\n`);
  process.exitCode = 1;
}
