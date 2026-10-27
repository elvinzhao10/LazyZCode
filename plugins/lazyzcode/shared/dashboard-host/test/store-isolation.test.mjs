import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fixture, plugin, processCall, pythonEnvironment } from './fixture.mjs';
import { RUNTIMES } from '../../project/contract.mjs';

// T3: one dashboard per repository, isolated per native store namespace. The
// neutral `.lazyseries` registry is shared, but accepted project state lives
// only under this runtime's `.lazyzcode` store. Foreign family runtimes — the
// sibling worktrees' real CLI entries when present — are refused against the
// same root and never mutate the owning store's bytes.
const OWN_RUNTIME = 'LazyZCode';
const OWN_STORE = '.lazyzcode';
const PROJECT_ID = 'project:zcode';
const ACTOR = 'test:zcode';
const vendoredCLI = join(plugin, 'shared/project/cli.mjs');
// worktrees/<Repo>/1.4.0-completion/... — siblings resolve relative to this
// worktree so the refusal matrix runs wherever the family checkouts live.
const worktreesRoot = dirname(join(plugin, '../..'));
const FAMILY = [
  { runtime: 'LazyZCode', projectId: 'project:zcode', store: '.lazyzcode', actor: 'test:zcode',
    entry: 'LazyZCode/1.4.0-completion/plugins/lazyzcode/shared/project/cli.mjs' },
  { runtime: 'LazyKimi', projectId: 'project:kimi', store: '.lazykimi', actor: 'test:kimi',
    entry: 'LazyKimi/1.4.0-completion/lazykimi-plugin/shared/project/cli.mjs' },
  { runtime: 'LazyDeepSeek', projectId: 'project:deepseek', store: '.lazydeepseek', actor: 'test:deepseek',
    entry: 'LazyDeepSeek/1.4.0-completion/plugins/lazydeepseek/shared/project/cli.mjs' },
];
const FOREIGN_RUNTIME = RUNTIMES.find(name => name !== OWN_RUNTIME);
const SIBLINGS = FAMILY.filter(member => member.runtime !== OWN_RUNTIME);
const REGISTRY = '.lazyseries/project.json';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const present = path => access(path).then(() => true, () => false);

async function storeBytes(root) {
  const files = new Map();
  for (const namespace of ['.lazyseries', ...FAMILY.map(member => member.store)]) {
    const base = join(root, namespace);
    if (!(await present(base))) continue;
    const walk = async prefix => {
      for (const entry of (await readdir(join(base, prefix || '.'), { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(relative);
        else if (entry.isFile()) files.set(`${namespace}/${relative}`,
          sha256(await readFile(join(base, relative))));
      }
    };
    await walk('');
  }
  return files;
}

function ownCLI(root, action, projectId = PROJECT_ID, input = '') {
  return processCall([process.execPath, vendoredCLI, action, '--project-root', root,
    '--project-id', projectId, '--actor', ACTOR], input, pythonEnvironment);
}

function foreignCLI(root, member, action, projectId, input = '') {
  return processCall([process.execPath, join(worktreesRoot, member.entry), action, '--project-root', root,
    '--project-id', projectId, '--actor', member.actor], input, pythonEnvironment);
}

const registerSource = (command_id, expected_revision, id, role, path) => JSON.stringify(
  { schema_version: 1, command_id, project_id: PROJECT_ID, expected_revision,
    operation: 'register_source', payload: { id, role, path } });

test('the dashboard project store binds only to this runtime namespace', async () => {
  const f = await fixture();
  try {
    const initiated = await f.call('project.mjs', 'init', []);
    assert.equal(initiated.code, 0, initiated.stderr);
    const read = JSON.parse((await f.call('project.mjs', 'read', [])).stdout);
    assert.equal(read.runtime, OWN_RUNTIME);
    assert.equal(read.project_id, PROJECT_ID);
    const registry = JSON.parse(await readFile(join(f.root, REGISTRY), 'utf8'));
    assert.equal(registry.runtime, OWN_RUNTIME, 'the neutral registry names this owning runtime');
    const owner = JSON.parse(await readFile(join(f.root, OWN_STORE, 'project/owner.json'), 'utf8'));
    assert.equal(owner.owner, `${OWN_RUNTIME}/project`);
    for (const member of SIBLINGS) {
      assert.equal(await present(join(f.root, member.store)), false,
        `${member.store} must not exist in this runtime's fixture root`);
    }
    const context = JSON.parse((await f.call('project.mjs', 'project.context', [])).stdout);
    assert.equal(context.result.status, 'ok');
    assert.equal(context.result.project_id, PROJECT_ID);
    assert.equal(context.result.summary.project.runtime, OWN_RUNTIME,
      'the dashboard adapter resolves only its own store namespace');
  } finally { await f.cleanup(); }
});

test('foreign sibling runtimes are refused against the same root without cross-store mutation', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('project.mjs', 'init', [])).code, 0);
    await writeFile(join(f.root, 'project-plan.md'), '# Isolation plan\n\n- [ ] [C1] Criterion\n');
    const before = await storeBytes(f.root);
    for (const member of SIBLINGS) {
      if (!(await present(join(worktreesRoot, member.entry)))) continue;
      // A foreign runtime initializing with its own identity hits the shared registry guard.
      const foreignIdentity = await foreignCLI(f.root, member, 'init', member.projectId);
      assert.notEqual(foreignIdentity.code, 0, `${member.runtime} init with its own id must fail closed`);
      assert.equal(foreignIdentity.stderr.trim(), 'PROJECT_IDENTITY_MISMATCH');
      // A foreign runtime impersonating this project's identity hits the F-04 runtime guard.
      const impersonating = await foreignCLI(f.root, member, 'init', PROJECT_ID);
      assert.notEqual(impersonating.code, 0, `${member.runtime} init under ${PROJECT_ID} must fail closed`);
      assert.equal(impersonating.stderr.trim(), 'REGISTRY_FOREIGN_RUNTIME');
      // Reads and commands resolve only the foreign runtime's own (absent) namespace.
      const foreignRead = await foreignCLI(f.root, member, 'read', PROJECT_ID);
      assert.notEqual(foreignRead.code, 0);
      assert.equal(foreignRead.stderr.trim(), 'PROJECT_NOT_INITIALIZED');
      const foreignCommand = await foreignCLI(f.root, member, 'command', PROJECT_ID,
        registerSource(`${member.runtime}:foreign`, 0, 'source:foreign', 'overview', 'foreign-plan.md'));
      assert.notEqual(foreignCommand.code, 0);
      assert.equal(foreignCommand.stderr.trim(), 'PROJECT_NOT_INITIALIZED');
      assert.deepEqual(await storeBytes(f.root), before,
        `${member.runtime} probes must not mutate any store or registry byte`);
      assert.equal(await present(join(f.root, member.store)), false,
        `a refused ${member.runtime} probe creates no ${member.store} store`);
    }
    const read = JSON.parse((await f.call('project.mjs', 'read', [])).stdout);
    assert.equal(read.runtime, OWN_RUNTIME, 'the owning store still serves its own namespace');
  } finally { await f.cleanup(); }
});

test('a foreign-owned registry and tampered state are refused without rewriting bytes', async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, 'project-plan.md'), '# Isolation plan\n\n- [ ] [C1] Criterion\n');
    await writeFile(join(f.root, 'other-plan.md'), '# Other plan\n');
    assert.equal((await f.call('project.mjs', 'init', [])).code, 0);
    const registered = await ownCLI(f.root, 'command', PROJECT_ID,
      registerSource('iso:register', 0, 'source:plan', 'plan', 'project-plan.md'));
    assert.equal(registered.code, 0, registered.stderr);
    const registryPath = join(f.root, REGISTRY);
    const statePath = join(f.root, OWN_STORE, 'project/state.json');
    const ownedRegistry = await readFile(registryPath);
    const ownedState = await readFile(statePath);

    // F-04: a registry another runtime owns is never adopted or mirrored.
    await writeFile(registryPath, JSON.stringify({ ...JSON.parse(ownedRegistry), runtime: FOREIGN_RUNTIME }) + '\n');
    const foreignBytes = await readFile(registryPath);
    const refusedInit = await ownCLI(f.root, 'init');
    assert.notEqual(refusedInit.code, 0);
    assert.equal(refusedInit.stderr.trim(), 'REGISTRY_FOREIGN_RUNTIME');
    assert.equal((await readFile(registryPath)).equals(foreignBytes), true,
      'a refused init leaves the foreign registry byte-identical');
    const refusedMirror = await ownCLI(f.root, 'command', PROJECT_ID,
      registerSource('iso:mirror', 1, 'source:other', 'overview', 'other-plan.md'));
    assert.notEqual(refusedMirror.code, 0);
    assert.equal(refusedMirror.stderr.trim(), 'REGISTRY_FOREIGN_RUNTIME');
    assert.equal((await readFile(registryPath)).equals(foreignBytes), true,
      'the refused mirror leaves the foreign registry byte-identical');
    await writeFile(registryPath, ownedRegistry);
    assert.equal(JSON.parse((await ownCLI(f.root, 'read')).stdout).runtime, OWN_RUNTIME);

    // Tampered state: a foreign runtime planted in this namespace is refused, never adopted.
    await writeFile(statePath, JSON.stringify({ ...JSON.parse(ownedState), runtime: FOREIGN_RUNTIME }));
    const planted = await readFile(statePath);
    const refusedRead = await ownCLI(f.root, 'read');
    assert.notEqual(refusedRead.code, 0);
    assert.equal(refusedRead.stderr.trim(), 'PROJECT_IDENTITY_MISMATCH');
    assert.equal((await readFile(statePath)).equals(planted), true,
      'the planted foreign state is never rewritten by the refusal');
    // Malformed state bytes are rejected typed.
    await writeFile(statePath, '{"runtime": "LazyZCode", "project_i');
    const malformed = await ownCLI(f.root, 'read');
    assert.notEqual(malformed.code, 0);
    assert.equal(malformed.stderr.trim(), 'INVALID_JSON');

    // The owning bytes restore and the dashboard namespace resolves again.
    await writeFile(statePath, ownedState);
    await writeFile(registryPath, ownedRegistry);
    const recovered = await ownCLI(f.root, 'read');
    assert.equal(recovered.code, 0, recovered.stderr);
    const restored = JSON.parse(recovered.stdout);
    assert.equal(restored.runtime, OWN_RUNTIME);
    assert.ok(restored.revision >= 1, 'the restored accepted state keeps its receipts');
  } finally { await f.cleanup(); }
});
