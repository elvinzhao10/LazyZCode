import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, plugin, host, digest, testPython, pythonEnvironment } from './fixture.mjs';

const projectCli = join(host, '../project/cli.mjs');
const projectHost = join(host, 'project.mjs');
const vendorSidecar = join(plugin, 'shared/project.vendor.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function walk(root, base = '') {
  const files = [];
  for (const entry of (await readdir(join(root, base || '.'), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === '__pycache__') continue;
      for (const nested of await walk(root, name)) files.push(nested);
    } else if (entry.isFile()) files.push(name);
  }
  return files;
}

test('vendored project tree is byte-identical to its pinned sidecar', async () => {
  const manifest = JSON.parse(await readFile(vendorSidecar, 'utf8'));
  assert.equal(manifest.source.path, 'lazybuddy-plugin/shared/project');
  assert.equal(manifest.boundary.hostAdapter, 'not-included');
  const present = await walk(join(plugin, 'shared/project'));
  assert.deepEqual([...present].sort(), manifest.files.map(item => item.path).sort());
  const records = [];
  for (const item of manifest.files) {
    const bytes = await readFile(join(plugin, 'shared/project', item.path));
    assert.equal(bytes.length, item.bytes, `${item.path} byte drift`);
    assert.equal(sha256(bytes), item.sha256, `${item.path} content drift`);
    records.push(`${item.path}\0${item.bytes}\0${item.sha256}\n`);
  }
  assert.equal(sha256(Buffer.from(records.join(''))), manifest.source.treeSha256, 'tree digest drift');
});

test('project reads and tools stay inert before initialization', async () => {
  const f = await fixture();
  try {
    const raw = await f.call('project.mjs', 'read', []);
    assert.equal(raw.code, 65); assert.equal(raw.stderr.trim(), 'PROJECT_NOT_INITIALIZED');
    const tool = await f.call('project.mjs', 'project.context', []);
    assert.equal(tool.code, 0, tool.stderr);
    const envelope = JSON.parse(tool.stdout);
    assert.equal(envelope.result.status, 'not_initialized');
    assert.equal(envelope.result.hint, 'PROJECT_NOT_INITIALIZED');
    assert.equal(envelope.result.init_offer.kind, 'question');
    assert.equal(envelope.delivery.consumed_by_native, false);
    const stat = await lstat(join(f.root, '.lazyzcode/project')).then(() => true, () => false);
    assert.equal(stat, false, 'no project store may exist before explicit init');
    const registry = await lstat(join(f.root, '.lazyseries')).then(() => true, () => false);
    assert.equal(registry, false, 'no neutral registry may exist before explicit init');
  } finally { await f.cleanup(); }
});

test('ZCode project round trip binds a create-run.sh run through ZCode-owned identity', async () => {
  const f = await fixture();
  try {
    const initiated = await f.call('project.mjs', 'init', []);
    assert.equal(initiated.code, 0, initiated.stderr);
    const created = JSON.parse(initiated.stdout);
    assert.equal(created.project_id, 'project:zcode'); assert.equal(created.runtime, 'LazyZCode');
    const planText = '# ZCode project plan\n\n- [ ] [C1] Original ZCode criterion\n\nUnrelated prose stays.\n';
    await writeFile(join(f.root, 'project-plan.md'), planText);
    const command = (command_id, expected_revision, operation, payload) => f.call('project.mjs', 'command', [], JSON.stringify(
      { schema_version: 1, command_id, project_id: 'project:zcode', expected_revision, operation, payload }));
    const registered = await command('cmd:source', 0, 'register_source', { id: 'source:plan', role: 'plan', path: 'project-plan.md' });
    assert.equal(registered.code, 0, registered.stderr);
    assert.equal(JSON.parse(registered.stdout).receipt.status, 'saved');
    const planned = await command('cmd:plan', 1, 'register_plan', { id: 'plan:zcode', source: { source_id: 'source:plan',
      sha256: sha256(Buffer.from(planText)), anchor_id: 'document' }, declared_lifecycle: 'active', baseline_refs: [] });
    assert.equal(planned.code, 0, planned.stderr);
    const linked = await command('cmd:link', 2, 'link_native_run',
      { plan_id: 'plan:zcode', native_project_id: 'project:zcode', run_id: 'probe' });
    assert.equal(linked.code, 0, linked.stderr);
    assert.deepEqual(JSON.parse(linked.stdout).receipt.changed_ids, ['plan:zcode']);
    const read = JSON.parse((await f.call('project.mjs', 'read', [])).stdout);
    const plan = read.plans.find(entry => entry.id === 'plan:zcode');
    assert.deepEqual(plan.native_runs.map(entry => entry.run_id), ['probe']);
    assert.equal(read.runtime, 'LazyZCode');
    // A run the create-run.sh store never created cannot be linked; a foreign
    // native project identity is refused without touching accepted state.
    const missing = await command('cmd:link-missing', 3, 'link_native_run',
      { plan_id: 'plan:zcode', native_project_id: 'project:zcode', run_id: 'absent' });
    assert.equal(missing.code, 65); assert.equal(missing.stderr.trim(), 'NATIVE_RUN_UNAVAILABLE');
    const foreign = await command('cmd:link-foreign', 3, 'link_native_run',
      { plan_id: 'plan:zcode', native_project_id: 'project:other', run_id: 'probe' });
    assert.equal(foreign.code, 65); assert.equal(foreign.stderr.trim(), 'NATIVE_RUN_IDENTITY_MISMATCH');
    const stale = await command('cmd:link-stale', 1, 'link_native_run',
      { plan_id: 'plan:zcode', native_project_id: 'project:zcode', run_id: 'probe' });
    assert.equal(JSON.parse(stale.stdout).receipt.status, 'conflict');
    const replay = await command('cmd:link', 2, 'link_native_run',
      { plan_id: 'plan:zcode', native_project_id: 'project:zcode', run_id: 'probe' });
    assert.equal(JSON.parse(replay.stdout).receipt.revision, JSON.parse(linked.stdout).receipt.revision);
    assert.equal((await readFile(join(f.root, 'project-plan.md'), 'utf8')), planText);
  } finally { await f.cleanup(); }
});

test('source edit through the vendored route lands on the registered original document', async () => {
  const f = await fixture();
  try {
    await f.call('project.mjs', 'init', []);
    const fence = '```json\n{"unrelated": ["example"]}\n```\n';
    const planText = '# ZCode project plan\n\n- [ ] [C1] Original ZCode criterion\n\nUnrelated prose stays.\n';
    await writeFile(join(f.root, 'project-plan.md'), planText + fence);
    const command = (command_id, expected_revision, operation, payload) => f.call('project.mjs', 'command', [], JSON.stringify(
      { schema_version: 1, command_id, project_id: 'project:zcode', expected_revision, operation, payload }));
    await command('cmd:source', 0, 'register_source', { id: 'source:plan', role: 'plan', path: 'project-plan.md' });
    const mapped = await f.call('project.mjs', 'source.map', [], JSON.stringify({ command_id: 'q:map', expected_revision: 1,
      payload: { source_id: 'source:plan' } }));
    const map = JSON.parse(mapped.stdout).result;
    assert.equal(map.status, 'ok'); assert.equal(map.observation, 'current');
    const anchor = map.anchors.find(entry => entry.title === 'ZCode project plan');
    assert.ok(anchor, 'heading anchor assigned');
    const edit = { command_id: 'cmd:check-c1', expected_revision: 1,
      payload: { authority: 'test:zcode', source_id: 'source:plan', expected_sha256: map.sha256,
        expected_source_revision: 1, edits: [{ kind: 'set_task_state', anchor_id: anchor.anchor_id, item: 0, state: 'checked' }] } };
    const applied = await f.call('project.mjs', 'source.edit', [], JSON.stringify(edit));
    assert.equal(applied.code, 0, applied.stderr);
    const after = await readFile(join(f.root, 'project-plan.md'), 'utf8');
    assert.equal(after, '# ZCode project plan\n\n- [x] [C1] Original ZCode criterion\n\nUnrelated prose stays.\n' + fence,
      'only the addressed checklist item changes');
    const receipt = JSON.parse(applied.stdout).receipt;
    assert.equal(receipt.status, 'saved'); assert.equal(receipt.revision, 2);
    const replay = await f.call('project.mjs', 'source.edit', [], JSON.stringify(edit));
    assert.equal(JSON.parse(replay.stdout).receipt.revision, 2, 'idempotent replay returns the same receipt');
    assert.equal(await readFile(join(f.root, 'project-plan.md'), 'utf8'), after, 'replay does not rewrite the document');
    const stale = await f.call('project.mjs', 'source.edit', [], JSON.stringify({ ...edit, command_id: 'cmd:check-stale',
      expected_revision: 9, payload: { ...edit.payload, expected_sha256: digest('stale') } }));
    const outcome = JSON.parse(stale.stdout);
    assert.equal(outcome.receipt.status, 'conflict');
    const journal = await readdir(join(f.root, '.lazyzcode/project/edit-journal'));
    assert.deepEqual(journal, [], 'a completed edit leaves no pending journal entry');
  } finally { await f.cleanup(); }
});

test('observations record through the ZCode bounded producer and verifier publication path', async () => {
  const f = await fixture();
  try {
    const context = async (attempt, worker, index) => {
      const result = await f.call('producers.mjs', 'context', ['--parent-task-id', 'P', '--task-id', 'A', '--criterion-id', 'C1',
        '--attempt-id', attempt, '--worker-id', worker, '--plan-commands-file', join(f.run, 'commands.json'),
        '--command-index', String(index), '--python', testPython]);
      assert.equal(result.code, 0, result.stderr);
      const path = join(f.run, `${attempt.replace(':', '-')}.json`);
      await writeFile(path, result.stdout);
      return path;
    };
    const executor = await context('executor:zcode', 'worker:zcode-executor', 0);
    const executed = await f.call('producers.mjs', 'execute', ['--context-file', executor,
      '--artifact-path', '.lazyzcode/runs/probe/actual.txt', '--python', testPython]);
    assert.equal(executed.code, 0, executed.stderr);
    const verifier = await context('verifier:zcode', 'worker:zcode-verifier', 1);
    const verified = await f.call('producers.mjs', 'verify', ['--context-file', verifier,
      '--artifact-path', '.lazyzcode/runs/probe/actual.txt', '--executor-id', 'worker:zcode-executor',
      '--executor-attempt-id', 'executor:zcode', '--python', testPython]);
    assert.equal(verified.code, 0, verified.stderr);

    await f.call('project.mjs', 'init', []);
    const planText = '# ZCode project plan\n\n- [x] [C1] Original ZCode criterion\n';
    await writeFile(join(f.root, 'project-plan.md'), planText);
    const command = (command_id, expected_revision, operation, payload) => f.call('project.mjs', 'command', [], JSON.stringify(
      { schema_version: 1, command_id, project_id: 'project:zcode', expected_revision, operation, payload }));
    await command('cmd:source', 0, 'register_source', { id: 'source:plan', role: 'plan', path: 'project-plan.md' });
    await command('cmd:plan', 1, 'register_plan', { id: 'plan:zcode', source: { source_id: 'source:plan',
      sha256: sha256(Buffer.from(planText)), anchor_id: 'document' }, declared_lifecycle: 'active', baseline_refs: [] });
    await command('cmd:link', 2, 'link_native_run', { plan_id: 'plan:zcode', native_project_id: 'project:zcode', run_id: 'probe' });

    const observed = await f.call('project.mjs', 'observe', []);
    assert.equal(observed.code, 0, observed.stderr);
    const outcome = JSON.parse(observed.stdout);
    assert.deepEqual(outcome.recorded.sort(), ['observation:attempt:probe:executor:zcode',
      'observation:attempt:probe:verifier:zcode', 'observation:verifier:probe:A:C1']);
    assert.equal(outcome.snapshot.observation_revision, 3);
    const executorRecord = outcome.snapshot.observations.find(record => record.id === 'observation:attempt:probe:executor:zcode');
    assert.equal(executorRecord.classification, 'observed');
    assert.equal(executorRecord.provenance.kind, 'native_event');
    const activity = JSON.parse(executorRecord.text);
    assert.equal(activity.agent.id, 'worker:zcode-executor');
    assert.equal(activity.activity.state, 'finished');
    assert.equal(activity.delivery.consumption.status, 'observed');
    assert.equal(activity.conversational_telemetry.status, 'unavailable');
    const publication = outcome.snapshot.observations.find(record => record.id === 'observation:verifier:probe:A:C1');
    const verdict = JSON.parse(publication.text);
    assert.equal(verdict.verdict, 'approved');
    assert.equal(verdict.verifier.identity, 'worker:zcode-verifier');
    assert.notEqual(verdict.verifier.identity, verdict.executor.identity, 'verifier publication is a distinct identity');
    const read = JSON.parse((await f.call('project.mjs', 'read', [])).stdout);
    const plan = read.plans.find(entry => entry.id === 'plan:zcode');
    assert.equal(plan.native_observations.length, 1);
    assert.equal(plan.native_observations[0].run_id, 'probe');
    assert.equal(plan.native_observations[0].runtime, 'LazyZCode');
    assert.ok(['running', 'finished'].includes(plan.native_observations[0].execution), 'observed execution stays honest');
    const rerun = await f.call('project.mjs', 'observe', []);
    assert.equal(rerun.code, 0, rerun.stderr);
    const repeated = JSON.parse(rerun.stdout);
    assert.deepEqual(repeated.recorded, [], 'unchanged evidence coalesces to no new observation');
    assert.equal(repeated.snapshot.observation_revision, 3, 'coalesced observations leave the revision untouched');
  } finally { await f.cleanup(); }
});

async function mcpProject() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'lazyzcode-project-mcp-')));
  const gitEnv = { GIT_CONFIG_NOSYSTEM: '1', HOME: root, ...pythonEnvironment };
  const git = (...args) => {
    const result = spawnSync('git', ['-C', root, ...args], { env: { ...process.env, ...gitEnv } });
    if (result.status) throw new Error(result.stderr.toString());
  };
  git('init', '-q'); git('config', 'user.name', 'ZCode Project MCP QA'); git('config', 'user.email', 'zcode@example.invalid');
  await writeFile(join(root, '.gitignore'), '.lazyzcode/\n');
  git('add', '.gitignore'); git('-c', 'user.name=p', '-c', 'user.email=p@i', 'commit', '-qm', 'fixture');
  const created = spawnSync('bash', [join(plugin, 'scripts/state/create-run.sh'), 'probe', 'ZCode project MCP probe'],
    { env: { ...process.env, CWD: root, ...pythonEnvironment } });
  if (created.status) throw new Error(created.stderr.toString());
  return root;
}

test('status-dashboard MCP project tool round trip honors the mode gate', async () => {
  const root = await mcpProject();
  const server = join(plugin, 'mcp/status-dashboard/server.sh');
  const environment = { ...process.env, CWD: root, CLAUDE_PLUGIN_ROOT: plugin, LAZYZCODE_MCP_MODE: 'orchestrated' };
  const rpc = (id, method, params) => JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
  try {
    const session = await new Promise((resolve, reject) => {
      const child = spawn('bash', [server], { env: environment, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.stdin.end([rpc(1, 'initialize', {}), rpc(2, 'tools/list'),
        rpc(3, 'tools/call', { name: 'project', arguments: { action: 'project.context', project_id: 'project:zcode' } }),
        rpc(4, 'tools/call', { name: 'project', arguments: { action: 'source.map', project_id: 'project:zcode',
          request: { command_id: 'mcp:map-1', expected_revision: 0, payload: { source_id: 'source:plan' } } } })].join('\n') + '\n');
      child.on('close', () => resolve({ stdout, stderr }));
    });
    const replies = session.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(replies[1].result.tools.some(tool => tool.name === 'project'), true, 'project tool is declared');
    assert.equal(replies[1].result.tools.some(tool => tool.name === 'copy_task_context'), true, 'existing tools stay declared');
    const preInit = JSON.parse(replies[2].result.content[0].text);
    assert.equal(preInit.result.status, 'not_initialized');
    assert.equal(preInit.result.hint, 'PROJECT_NOT_INITIALIZED');
    assert.equal(preInit.result.init_offer.kind, 'question');
    const rejected = JSON.parse(replies[3].result.content[0].text);
    assert.equal(rejected.result.status, 'not_initialized', 'every project action answers the typed hint');
    assert.equal(await lstat(join(root, '.lazyzcode/project')).then(() => true, () => false), false,
      'the MCP tool never creates the project store');

    const initiated = spawnSync(process.execPath, [projectCli, 'init', '--project-root', root,
      '--project-id', 'project:zcode', '--actor', 'test:zcode'], { env: { ...process.env, ...pythonEnvironment } });
    assert.equal(initiated.status, 0, initiated.stderr.toString());

    const after = await new Promise((resolve, reject) => {
      const child = spawn('bash', [server], { env: environment, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', () => {});
      child.on('error', reject);
      child.stdin.end(rpc(7, 'tools/call', { name: 'project', arguments: { action: 'project.context', project_id: 'project:zcode' } }) + '\n');
      child.on('close', () => resolve(stdout));
    });
    const context = JSON.parse(JSON.parse(after.trim()).result.content[0].text);
    assert.equal(context.result.status, 'ok');
    assert.equal(context.result.project_id, 'project:zcode');
    assert.equal(context.result.summary.project.runtime, 'LazyZCode');
    assert.equal(context.delivery.native_delivery, 'unobserved', 'native delivery stays honestly unobserved');

    const gated = spawnSync('bash', [server], {
      env: { ...environment, LAZYZCODE_MCP_MODE: 'not-a-mode' }, input: rpc(8, 'tools/call',
        { name: 'project', arguments: { action: 'project.context', project_id: 'project:zcode' } }) + '\n'
    });
    assert.equal(gated.status, 2, 'the profile gate rejects an invalid mode before any tool');
    assert.match(gated.stderr.toString(), /MCP_PROFILE_INVALID/);
    assert.equal(gated.stdout.toString(), '', 'no project tool output escapes the gate');
  } finally { await rm(root, { recursive: true, force: true }); }
});
