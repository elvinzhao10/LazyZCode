#!/usr/bin/env node
'use strict';

// Regenerates contracts/marketplace-route-contract.v1.json payload inventory and
// artifact digests after any payload edit, then refreshes the .sha256 sidecar.
// Usage: node scripts/lazyzcode-regenerate-marketplace-contract.js [releaseRoot]

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const releaseRoot = process.argv[2] === undefined
  ? path.resolve(__dirname, '..', '..', '..')
  : path.resolve(process.argv[2]);
const pluginRoot = path.join(releaseRoot, 'plugins', 'lazyzcode');
const contractPath = path.join(pluginRoot, 'contracts', 'marketplace-route-contract.v1.json');

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

// Artifacts: byte digests of the two identity manifests.
for (const relative of Object.keys(contract.artifacts)) {
  contract.artifacts[relative] = digest(fs.readFileSync(path.join(releaseRoot, relative)));
}

// Payload inventory: same algorithm as lifecycle/marketplace-routes.js inventory().
const records = [];
const walk = (relative) => {
  const directory = path.join(pluginRoot, relative);
  for (const name of fs.readdirSync(directory).sort((l, r) => Buffer.compare(Buffer.from(l), Buffer.from(r)))) {
    const child = path.posix.join(relative, name);
    const absolute = path.join(pluginRoot, child);
    const stat = fs.lstatSync(absolute);
    if (stat.isDirectory() && !stat.isSymbolicLink()) walk(child);
    else if (stat.isFile() && stat.nlink === 1 && name !== '.gitkeep') {
      records.push({ path: child, sha256: digest(fs.readFileSync(absolute)) });
    } else if (name !== '.gitkeep') {
      throw new Error(`canonical payload must contain only regular files: ${child}`);
    }
  }
};
for (const root of contract.payload.roots) walk(root);
for (const relative of contract.payload.files) {
  records.push({ path: relative, sha256: digest(fs.readFileSync(path.join(pluginRoot, relative))) });
}
records.sort((l, r) => Buffer.compare(Buffer.from(l.path), Buffer.from(r.path)));
contract.payload.file_count = records.length;
contract.payload.inventory_sha256 = digest(Buffer.from(JSON.stringify(records)));

const serialized = `${JSON.stringify(contract, null, 2)}\n`;
fs.writeFileSync(contractPath, serialized);
fs.writeFileSync(`${contractPath}.sha256`, `${digest(Buffer.from(serialized))}  marketplace-route-contract.v1.json\n`);

process.stdout.write(`${JSON.stringify({ status: 'regenerated', file_count: contract.payload.file_count, inventory_sha256: contract.payload.inventory_sha256 })}\n`);
