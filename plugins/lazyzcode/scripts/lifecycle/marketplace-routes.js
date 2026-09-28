'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { LifecycleError } = require('./errors');
const { safeFile } = require('./files');

const CONTRACT_PATH = path.resolve(__dirname, '..', '..', 'contracts', 'marketplace-route-contract.v1.json');
const REMOTE_MARKETPLACE_ARTIFACT = 'marketplace.json';
const MARKETPLACE_ARTIFACT = 'plugins/marketplace.json';
const PLUGIN_DIR = 'plugins/lazyzcode';
const PLUGIN_MANIFEST_ARTIFACT = `${PLUGIN_DIR}/.zcode-plugin/plugin.json`;
// Canonical payload components: manifest component field -> plugin-root-relative target.
// ZCode's native manifest declares skills/commands/agents as directory strings and
// hooks as the hooks.json path; MCP servers live in the plugin-root .mcp.json, so the
// optional mcpServers pointer must name it when present.
const PAYLOAD_COMPONENTS = Object.freeze({
  skills: 'skills',
  commands: 'commands',
  agents: 'agents',
  hooks: 'hooks/hooks.json',
});
const OPTIONAL_COMPONENTS = Object.freeze({
  mcpServers: '.mcp.json',
});

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function jsonFile(file, code) {
  const bytes = safeFile(file, code).bytes;
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    throw new LifecycleError(code, `invalid JSON: ${file}`, error);
  }
}

function contract() {
  const contractFile = jsonFile(CONTRACT_PATH, 'MARKETPLACE_CONTRACT_INVALID');
  const expectedDigest = safeFile(`${CONTRACT_PATH}.sha256`, 'MARKETPLACE_CONTRACT_INVALID')
    .bytes.toString('utf8').trim().split(/\s+/)[0];
  if (digest(contractFile.bytes) !== expectedDigest) {
    throw new LifecycleError('MARKETPLACE_CONTRACT_INVALID', 'marketplace route contract digest mismatch');
  }
  const parsed = contractFile.value;
  if (parsed?.schema_version !== 1 || typeof parsed.version !== 'string'
    || !parsed.identity || !parsed.artifacts || !parsed.payload || !parsed.default_routes || !parsed.fallback) {
    throw new LifecycleError('MARKETPLACE_CONTRACT_INVALID', 'marketplace route contract is malformed');
  }
  return parsed;
}

function declaredPaths(value) {
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0 || values.some((item) => typeof item !== 'string' || item === '')) return null;
  return values.map((item) => item.replace(/^\.\//, '').replace(/\/$/, ''));
}

// ZCode plugin manifests may declare each component as a directory string or an
// array of paths; accept both spellings and require the canonical target.
function validateManifest(value, expectedVersion) {
  const manifest = value;
  const errorCode = manifest?.version === expectedVersion ? 'MARKETPLACE_IDENTITY_INVALID' : 'MARKETPLACE_VERSION_MISMATCH';
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new LifecycleError(errorCode, 'plugin manifest must be a JSON object');
  }
  if (manifest.name !== 'lazyzcode') {
    throw new LifecycleError(errorCode, 'plugin manifest name must be lazyzcode');
  }
  if (manifest.version !== expectedVersion) {
    throw new LifecycleError(errorCode, `plugin manifest version must be ${expectedVersion}`);
  }
  for (const [component, target] of Object.entries(PAYLOAD_COMPONENTS)) {
    if (!(component in manifest)) {
      throw new LifecycleError(errorCode, `plugin manifest does not declare ${component}`);
    }
    const paths = declaredPaths(manifest[component]);
    if (paths === null || !paths.includes(target)) {
      throw new LifecycleError(errorCode, `plugin manifest ${component} must declare ${target}`);
    }
  }
  for (const [component, target] of Object.entries(OPTIONAL_COMPONENTS)) {
    if (component in manifest) {
      const paths = declaredPaths(manifest[component]);
      if (paths === null || !paths.includes(target)) {
        throw new LifecycleError(errorCode, `plugin manifest ${component} must declare ${target}`);
      }
    }
  }
}

function inventory(pluginRoot, policy) {
  const records = [];
  const walk = (relative) => {
    const directory = path.join(pluginRoot, relative);
    let names;
    try {
      names = fs.readdirSync(directory).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
    } catch (error) {
      throw new LifecycleError('MARKETPLACE_PAYLOAD_INVALID', `canonical payload root unavailable: ${relative}`, error);
    }
    for (const name of names) {
      const child = path.posix.join(relative, name);
      const absolute = path.join(pluginRoot, child);
      const stat = fs.lstatSync(absolute);
      if (stat.isDirectory() && !stat.isSymbolicLink()) walk(child);
      else if (stat.isFile() && stat.nlink === 1 && name !== '.gitkeep') {
        records.push({ path: child, sha256: digest(safeFile(absolute, 'MARKETPLACE_PAYLOAD_INVALID').bytes) });
      } else if (name !== '.gitkeep') {
        throw new LifecycleError('MARKETPLACE_PAYLOAD_INVALID', `canonical payload must contain only regular files: ${child}`);
      }
    }
  };
  for (const root of policy.roots) walk(root);
  for (const relative of policy.files) {
    records.push({ path: relative, sha256: digest(safeFile(path.join(pluginRoot, relative), 'MARKETPLACE_PAYLOAD_INVALID').bytes) });
  }
  records.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  return records;
}

function validateArtifact(file, expectedDigest, expectedVersion) {
  const parsed = jsonFile(file, 'MARKETPLACE_MANIFEST_INVALID');
  if (digest(parsed.bytes) !== expectedDigest) {
    const version = parsed.value?.version ?? parsed.value?.plugins?.[0]?.version;
    const code = version === expectedVersion ? 'MARKETPLACE_IDENTITY_INVALID' : 'MARKETPLACE_VERSION_MISMATCH';
    throw new LifecycleError(code, `marketplace artifact bytes changed: ${file}`);
  }
  return parsed.value;
}

function resultForPayload(policy, payload, identity = {}) {
  if (payload.length !== policy.payload.file_count || digest(Buffer.from(JSON.stringify(payload))) !== policy.payload.inventory_sha256) {
    throw new LifecycleError('MARKETPLACE_PAYLOAD_INVALID', 'canonical marketplace payload inventory changed');
  }
  const marketplaceName = identity.marketplaceName ?? policy.identity.marketplace;
  return {
    version: policy.version,
    marketplace_name: marketplaceName,
    marketplace_path: identity.marketplacePath ?? null,
    plugin: policy.identity.plugin,
    install_id: `${policy.identity.plugin}@${marketplaceName}`,
    manifest_sha256: policy.artifacts[PLUGIN_MANIFEST_ARTIFACT],
    payload_inventory: payload.map((item) => item.path),
  };
}

function validateMarketplaceRoutes(releaseRoot) {
  const policy = contract();
  const artifacts = {};
  for (const [relative, expectedDigest] of Object.entries(policy.artifacts)) {
    artifacts[relative] = validateArtifact(path.join(releaseRoot, relative), expectedDigest, policy.version);
  }
  const marketplace = artifacts[MARKETPLACE_ARTIFACT];
  const remoteMarketplace = artifacts[REMOTE_MARKETPLACE_ARTIFACT];
  const entries = Array.isArray(marketplace?.plugins) ? marketplace.plugins : [];
  const entry = entries.find((item) => item && item.name === policy.identity.plugin) ?? null;
  const source = typeof entry?.source === 'string' ? entry.source
    : typeof entry?.source === 'object' && entry.source !== null ? entry.source.path : undefined;
  if (!marketplace || typeof marketplace.name !== 'string'
    || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(marketplace.name)
    || entries.length !== 1 || entry === null
    || entry.version !== policy.version || source !== './lazyzcode') {
    throw new LifecycleError('MARKETPLACE_IDENTITY_INVALID', 'ZCode marketplace identity does not match the contract');
  }
  const remoteEntries = Array.isArray(remoteMarketplace?.plugins) ? remoteMarketplace.plugins : [];
  const remoteEntry = remoteEntries[0];
  if (remoteMarketplace?.name !== marketplace.name || remoteEntries.length !== 1
    || remoteEntry?.name !== policy.identity.plugin || remoteEntry.version !== policy.version
    || remoteEntry.source !== './plugins/lazyzcode') {
    throw new LifecycleError('MARKETPLACE_IDENTITY_INVALID', 'ZCode GitHub marketplace identity does not match the contract');
  }
  validateManifest(artifacts[PLUGIN_MANIFEST_ARTIFACT], policy.version);
  const payload = inventory(path.join(releaseRoot, PLUGIN_DIR), policy.payload);
  return resultForPayload(policy, payload, { marketplaceName: marketplace.name, marketplacePath: MARKETPLACE_ARTIFACT });
}

function validateInstalledMarketplacePackage(pluginRoot) {
  const policy = contract();
  const manifest = validateArtifact(
    path.join(pluginRoot, '.zcode-plugin', 'plugin.json'),
    policy.artifacts[PLUGIN_MANIFEST_ARTIFACT],
    policy.version,
  );
  validateManifest(manifest, policy.version);
  return resultForPayload(policy, inventory(pluginRoot, policy.payload));
}

function defaultRouteForHost(host) {
  const route = contract().default_routes[host];
  if (!route) throw new LifecycleError('INVALID_HOST', `unsupported marketplace host: ${host}`);
  return route;
}

function fallbackPolicy() {
  return contract().fallback;
}

module.exports = {
  REMOTE_MARKETPLACE_ARTIFACT,
  MARKETPLACE_ARTIFACT,
  PLUGIN_DIR,
  PLUGIN_MANIFEST_ARTIFACT,
  defaultRouteForHost,
  fallbackPolicy,
  inventory,
  validateInstalledMarketplacePackage,
  validateMarketplaceRoutes,
};
