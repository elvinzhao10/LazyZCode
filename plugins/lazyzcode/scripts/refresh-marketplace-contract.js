#!/usr/bin/env node
// Regenerates contracts/marketplace-route-contract.v1.json from the current
// package tree and refreshes its .sha256 sidecar.
//
// Inventory method (documented in the contract's payload.method field):
// walk each payload root (skills, commands, agents, hooks, mcp) recursively
// from the plugin root; reject symlinks and non-regular files; skip entries
// named .gitkeep; include only regular files with st_nlink == 1. Record
// {path, sha256} per file with the POSIX path relative to plugins/lazyzcode
// and sha256 over the file bytes. Append policy.files entries the same way.
// Sort records byte-wise (Buffer.compare) by path. file_count is the record
// count; inventory_sha256 is the SHA-256 of the UTF-8 JSON serialization of
// the sorted record array (JSON.stringify, no whitespace, path order).
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { inventory } = require('./lifecycle/marketplace-routes');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const pluginRoot = path.join(repoRoot, 'plugins', 'lazyzcode');
const contractPath = path.join(pluginRoot, 'contracts', 'marketplace-route-contract.v1.json');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function build() {
  const payload = {
    method: [
      'Deterministic inventory: walk each payload root (skills, commands, agents, hooks, mcp) recursively from the plugin root;',
      'reject symlinks and non-regular files; skip entries named .gitkeep, __pycache__ directories, and .pyc bytecode; include only regular files with st_nlink == 1.',
      'Record {path, sha256} per file with the POSIX path relative to plugins/lazyzcode and sha256 over the file bytes.',
      'Append policy.files entries the same way. Sort records byte-wise (Buffer.compare) by path.',
      'file_count is the record count; inventory_sha256 is the SHA-256 of the UTF-8 JSON serialization of the sorted record array',
      '(JSON.stringify with default separators, no whitespace, insertion order = sorted path order).',
    ].join(' '),
    roots: ['skills', 'commands', 'agents', 'hooks', 'mcp'],
    files: ['.mcp.json'],
  };
  const records = inventory(pluginRoot, payload);
  payload.file_count = records.length;
  payload.inventory_sha256 = crypto.createHash('sha256').update(Buffer.from(JSON.stringify(records))).digest('hex');
  return {
    schema_version: 1,
    version: '1.3.2',
    identity: { marketplace: 'lazyzcode', owner: 'LazyZCode', plugin: 'lazyzcode', install_id: 'lazyzcode@lazyzcode' },
    artifacts: {
      'marketplace.json': sha256(path.join(repoRoot, 'marketplace.json')),
      'plugins/marketplace.json': sha256(path.join(repoRoot, 'plugins', 'marketplace.json')),
      'plugins/lazyzcode/.zcode-plugin/plugin.json': sha256(path.join(pluginRoot, '.zcode-plugin', 'plugin.json')),
    },
    payload,
    default_routes: { zcode: 'zcode-marketplace', 'zcode-ide': 'zcode-marketplace' },
    fallback: {
      route: 'manual-skills-mcp-fallback',
      excludes: ['commands', 'agents', 'hooks'],
      asset_manifest: 'plugins/lazyzcode/asset-source-manifest.v1.json',
      receipt_required_for_removal: true,
      coexists_with_marketplace: false,
    },
  };
}

const contract = build();
fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
fs.writeFileSync(`${contractPath}.sha256`, `${sha256(contractPath)}  marketplace-route-contract.v1.json\n`);
process.stdout.write(`contract refreshed: file_count=${contract.payload.file_count} inventory_sha256=${contract.payload.inventory_sha256}\n`);
