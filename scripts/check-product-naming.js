'use strict';

// Product-naming policy for the LazyZCode repository.
//
// Scans every text file for former display names of this product line
// (LazyQoder / Qoder / QoderCLI / QoderWork) and fails when an occurrence is
// not covered by .product-naming-allowlist.json. Also pins stable machine IDs
// and requires the current host pages to use canonical ZCode spellings.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.env.PRODUCT_NAMING_ROOT ? path.resolve(process.env.PRODUCT_NAMING_ROOT) : path.resolve(__dirname, '..');
const ALLOWLIST_PATH = path.join(root, '.product-naming-allowlist.json');
const FORMER_NAME_PATTERN = /\b(?:LazyQoder|QoderCLI|QoderWork|Qoder|LazyCode)\b/g;
const STABLE_ID_SUFFIX = '.stable-ids';
const CLASSIFICATIONS = new Set([
  'verbatim-eval-quote', 'attribution', 'old-release-note',
  'immutable-historical-fixture', 'source-identity', 'stable-machine-id', 'old-note',
]);

function fail(message) {
  process.stderr.write(`NAMING_ERROR: ${message}\n`);
  process.exitCode = 1;
}

function parseAllowlist() {
  let raw;
  try {
    raw = fs.readFileSync(ALLOWLIST_PATH, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      fail(`cannot parse .product-naming-allowlist.json: ENOENT: no such file or directory, open '${ALLOWLIST_PATH}'`);
      return null;
    }
    throw error;
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    fail(`cannot parse .product-naming-allowlist.json: ${error.message}`);
    return null;
  }
  if (!value || !Array.isArray(value.formerDisplayNames) || !Array.isArray(value.stableIdentityFiles) || !Array.isArray(value.currentCliPages)) {
    fail('allowlist must define formerDisplayNames, stableIdentityFiles, and currentCliPages arrays');
    return null;
  }
  for (const [index, entry] of value.formerDisplayNames.entries()) {
    if (typeof entry.path !== 'string' || typeof entry.text !== 'string' || !Number.isInteger(entry.count) || entry.count < 1
      || !CLASSIFICATIONS.has(entry.classification) || typeof entry.reason !== 'string' || entry.reason === '') {
      fail(`formerDisplayNames[${index}] requires path, text, positive count, approved classification, and reason`);
      return null;
    }
  }
  for (const [index, entry] of value.stableIdentityFiles.entries()) {
    if (typeof entry.path !== 'string' || !entry.ids || typeof entry.ids !== 'object' || Array.isArray(entry.ids)
      || !Object.entries(entry.ids).every(([id, count]) => typeof id === 'string' && Number.isInteger(count) && count >= 0)) {
      fail(`stableIdentityFiles[${index}] requires path and ids object`);
      return null;
    }
  }
  if (value.currentCliPages.some(item => typeof item !== 'string' || item === '')) fail('currentCliPages entries must be non-empty paths');
  return value;
}

function walkFiles(directory, base = directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.study') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute, base));
    else if (entry.isFile()) files.push(path.relative(base, absolute).split(path.sep).join('/'));
  }
  return files;
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  } catch {
    // Repository checkouts are transport-only; fall back to a filesystem walk.
    return walkFiles(root);
  }
}

function readText(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  return buffer.includes(0) ? null : buffer.toString('utf8');
}

function countExact(content, text) {
  return content.split(text).length - 1;
}

const allowlist = parseAllowlist();
if (allowlist) {
  const files = trackedFiles();
  const observed = new Map();
  for (const relativePath of files) {
    if (relativePath === '.product-naming-allowlist.json' || relativePath === 'scripts/check-product-naming.js') continue;
    const content = readText(relativePath);
    if (content === null) continue;
    for (const match of content.matchAll(FORMER_NAME_PATTERN)) {
      const key = `${relativePath}\0${match[0]}`;
      observed.set(key, (observed.get(key) || 0) + 1);
    }
    if (/\bqodercli\b/i.test(content.replace(/former host|earlier host|historical/gi, ''))) {
      // QoderCLI executable references are retired; flag any that survive outside allowlisted history.
      const key = `${relativePath}\0QoderCLI`;
      if (!observed.has(key)) fail(`${relativePath} uses the retired qodercli executable name`);
    }
    if (/\bqoderwork\b/i.test(content)) fail(`${relativePath} uses the retired QoderWork adapter name`);
  }

  const allowed = new Set();
  for (const entry of allowlist.formerDisplayNames) {
    const key = `${entry.path}\0${entry.text}`;
    if (allowed.has(key)) fail(`duplicate former display-name allowlist entry: ${entry.path} :: ${entry.text}`);
    allowed.add(key);
    const actual = observed.get(key) || 0;
    if (actual !== entry.count) fail(`${entry.path} :: ${entry.text} expected ${entry.count} allowlisted occurrence(s), found ${actual}`);
  }
  for (const [key, count] of observed.entries()) {
    if (!allowed.has(key)) fail(`${key.replace('\0', ' :: ')} has ${count} unallowlisted former display-name occurrence(s)`);
  }

  for (const entry of allowlist.stableIdentityFiles) {
    const content = readText(entry.path);
    if (content === null) {
      fail(`${entry.path} stable identity contract is not text`);
      continue;
    }
    for (const [id, expected] of Object.entries(entry.ids)) {
      const actual = countExact(content, id);
      if (actual !== expected) fail(`${entry.path} stable ID ${id} expected ${expected} occurrence(s), found ${actual}`);
    }
  }

  for (const relativePath of allowlist.currentCliPages) {
    const content = readText(relativePath);
    if (content === null || !content.includes('ZCode') || !content.includes('zcode')) {
      fail(`${relativePath} must use the canonical ZCode product and executable spellings`);
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
process.stdout.write('NAMING_OK: zero unallowlisted former display names; stable IDs and product spellings verified\n');
