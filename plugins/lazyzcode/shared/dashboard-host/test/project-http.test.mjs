import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { digest, fixture, host, plugin, processCall, pythonEnvironment, testPython } from './fixture.mjs';
import { listen } from '../service-http.mjs';
import { ServiceError } from '../service-files.mjs';

const projectId = 'project:zcode';
const sourceId = 'source:plans/../release';

async function http(origin, path, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const call = request(`${origin}${path}`, { method: options.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { ...(body === undefined ? {} : { origin, 'content-type': 'application/json',
        'content-length': Buffer.byteLength(body) }), ...options.headers }, timeout: 10000 }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, value: JSON.parse(text) }));
    });
    call.on('error', reject); call.on('timeout', () => call.destroy(new Error('HTTP_TIMEOUT'))); call.end(body);
  });
}

test('ZCode evidence preview preserves an indexed-file race as HTTP 409', async () => {
  const credential = 'a'.repeat(64); const control = { credential, identity: { instance: 'race', port: 0 } };
  const live = await listen({ port: 0, projectRoot: 'unused', projectId, runId: null, authority: {
    readProjectEvidencePreview: async () => { throw new ServiceError('ARTIFACT_CHANGED', 409); },
  } }, control);
  try {
    const session = await http(live.origin, '/api/session', { body: {}, headers: { 'x-dashboard-bootstrap': credential } });
    const response = await http(live.origin, '/api/project/evidence/preview', { body: { artifact_id: 'artifact:race' },
      headers: { authorization: `Bearer ${session.value.token}` } });
    assert.equal(response.status, 409); assert.equal(response.value.code, 'ARTIFACT_CHANGED');
  } finally { await live.close(); }
});

test('ZCode native source capture resolves only a registered source identity', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('project.mjs', 'init', [])).code, 0);
    const content = '# ZCode registered plan\n\nDescriptor-pinned content.\n';
    await mkdir(join(f.root, 'docs')); await writeFile(join(f.root, 'docs/project-plan.md'), content);
    const command = { schema_version: 1, command_id: 'source:http', project_id: projectId, expected_revision: 0,
      operation: 'register_source', payload: { id: sourceId, role: 'plan', path: 'docs/project-plan.md' } };
    assert.equal((await f.call('project.mjs', 'command', [], JSON.stringify(command))).code, 0);
    const invoke = id => processCall([testPython, join(plugin, 'scripts/state/project-dashboard-bridge.py'), 'source',
      '--project-root', f.root, '--project-id', projectId, '--actor', 'test:zcode-http', '--node', process.execPath],
    JSON.stringify({ source_id: id }), pythonEnvironment);
    const captured = await invoke(sourceId);
    assert.equal(captured.code, 0, captured.stderr);
    assert.deepEqual(JSON.parse(captured.stdout), { source_id: sourceId, path: 'docs/project-plan.md', sha256: digest(content), content });
    const arbitraryPath = await invoke('docs/project-plan.md');
    assert.equal(arbitraryPath.code, 65); assert.equal(arbitraryPath.stderr.trim(), 'UNKNOWN_SOURCE');
    await writeFile(join(f.root, 'docs/project-plan.md'), Buffer.alloc(1024 * 1024 + 1, 0x61));
    const oversized = await invoke(sourceId);
    assert.equal(oversized.code, 65); assert.equal(oversized.stderr.trim(), 'SOURCE_UNAVAILABLE');
  } finally { await f.cleanup(); }
});

test('ZCode project HTTP routes require auth and preserve source identity plus command CAS', async () => {
  const f = await fixture(); const cli = join(host, 'cli.mjs'); const binding = f.binding.slice(0, 6); let live;
  const call = action => processCall([process.execPath, cli, action, ...binding, '--python', testPython], '', pythonEnvironment);
  try {
    live = JSON.parse((await call('open')).stdout);
    assert.equal((await http(live.url, '/api/project')).status, 401);
    const credential = await readFile(live.credential_file, 'utf8');
    const session = await http(live.url, '/api/session', { body: {}, headers: { 'x-dashboard-bootstrap': credential } });
    const auth = { authorization: `Bearer ${session.value.token}` };
    const missing = await http(live.url, '/api/project', { headers: auth });
    assert.equal(missing.status, 404); assert.equal(missing.value.code, 'PROJECT_NOT_INITIALIZED');
    assert.equal((await f.call('project.mjs', 'init', [])).code, 0);
    const content = '# ZCode HTTP plan\n\nSource bytes stay exact.\n';
    await mkdir(join(f.root, 'docs')); await writeFile(join(f.root, 'docs/project-plan.md'), content);
    const register = { schema_version: 1, command_id: 'http:source', project_id: projectId, expected_revision: 0,
      operation: 'register_source', payload: { id: sourceId, role: 'plan', path: 'docs/project-plan.md' } };
    const saved = await http(live.url, '/api/project/commands', { body: register, headers: auth });
    assert.equal(saved.status, 200); assert.equal(saved.value.receipt.status, 'saved');
    const project = await http(live.url, '/api/project', { headers: auth });
    assert.equal(project.status, 200); assert.equal(project.value.project.runtime, 'LazyZCode');
    const source = await http(live.url, `/api/project/sources/${encodeURIComponent(sourceId)}`, { headers: auth });
    assert.equal(source.status, 200); assert.equal(source.value.content, content); assert.equal(source.value.sha256, digest(content));
    assert.equal(source.value.source_id, sourceId);
    await writeFile(join(f.root, '.lazyzcode/dashboard/protected-canary.txt'), 'never-index-dashboard-private-state');
    await mkdir(join(f.run, 'evidence'), { recursive: true });
    await writeFile(join(f.run, 'evidence/preview.md'), '# Preview route\n\nBounded Markdown evidence.\n');
    let evidence;
    for (const path of ['/api/project/architecture', '/api/project/git', '/api/project/evidence']) {
      const detail = await http(live.url, path, { headers: auth });
      assert.equal(detail.status, 200, `${path} is available`);
      assert.equal(JSON.stringify(detail.value).includes('never-index-dashboard-private-state'), false);
      if (path === '/api/project/evidence') evidence = detail;
    }
    const previewEntry = evidence.value.entries.find(entry => entry.path.endsWith('/evidence/preview.md'));
    assert.ok(previewEntry, 'the indexed evidence file has an exact artifact identity');
    const preview = await http(live.url, '/api/project/evidence/preview', {
      body: { artifact_id: previewEntry.id }, headers: auth });
    assert.equal(preview.status, 200); assert.equal(preview.value.available, true); assert.equal(preview.value.kind, 'markdown');
    assert.equal(JSON.stringify(preview.value).includes('Preview route'), true);
    const unknownPreview = await http(live.url, '/api/project/evidence/preview', {
      body: { artifact_id: 'artifact:missing' }, headers: auth });
    assert.equal(unknownPreview.status, 404); assert.equal(unknownPreview.value.code, 'UNKNOWN_ARTIFACT');
    const invalidPreview = await http(live.url, '/api/project/evidence/preview', {
      body: { artifact_id: previewEntry.id, extra: true }, headers: auth });
    assert.equal(invalidPreview.status, 400); assert.equal(invalidPreview.value.code, 'INVALID_ARTIFACT_ID');
    await unlink(join(f.run, 'evidence/preview.md'));
    await symlink('/etc/passwd', join(f.run, 'evidence/preview.md'));
    const refusedPreview = await http(live.url, '/api/project/evidence/preview', {
      body: { artifact_id: previewEntry.id }, headers: auth });
    assert.equal(refusedPreview.status, 200); assert.equal(refusedPreview.value.available, false);
    assert.equal(refusedPreview.value.reason, 'artifact_inaccessible');
    assert.equal(JSON.stringify(refusedPreview.value).includes('root:'), false, 'symlink target bytes never cross the route');
    const plan = { schema_version: 1, command_id: 'http:plan', project_id: projectId, expected_revision: 1,
      operation: 'register_plan', payload: { id: 'plan:http', source: { source_id: sourceId, sha256: digest(content),
        anchor_id: 'document' }, declared_lifecycle: 'planned', baseline_refs: [] } };
    assert.equal((await http(live.url, '/api/project/commands', { body: plan, headers: auth })).status, 200);
    const assessment = await http(live.url, '/api/project/plan-transition-assessment', {
      body: { plan_id: 'plan:http', to_lifecycle: 'abandoned', payload: { reason: 'fixture cleanup' } }, headers: auth });
    assert.equal(assessment.status, 200); assert.equal(assessment.value.allowed, true);
    const unknown = await http(live.url, `/api/project/sources/${encodeURIComponent('source:missing')}`, { headers: auth });
    assert.equal(unknown.status, 404); assert.equal(unknown.value.code, 'UNKNOWN_SOURCE');
    const invalid = await http(live.url, '/api/project/sources/%252e%252e', { headers: auth });
    assert.equal(invalid.status, 400); assert.equal(invalid.value.code, 'INVALID_SOURCE_ID');
    const stale = await http(live.url, '/api/project/commands', { body: { ...register, command_id: 'http:stale' }, headers: auth });
    assert.equal(stale.status, 409); assert.equal(stale.value.receipt.status, 'conflict');
  } finally {
    if (live) await call('stop');
    await f.cleanup();
  }
});

test('ZCode project-only lifecycle preflights project state and keeps run routes unavailable', async () => {
  const f = await fixture(); const cli = join(host, 'cli.mjs'); const binding = f.binding.slice(0, 4); let live;
  const call = action => processCall([process.execPath, cli, action, ...binding, '--python', testPython], '', pythonEnvironment);
  try {
    const refused = await call('start');
    assert.equal(refused.code, 65); assert.equal(JSON.parse(refused.stderr).code, 'PROJECT_NOT_INITIALIZED');
    assert.equal((await f.call('project.mjs', 'init', [])).code, 0);
    live = JSON.parse((await call('open')).stdout); assert.equal(live.identity.runId, null);
    const status = JSON.parse((await call('status')).stdout);
    assert.equal(status.identity.instance, live.identity.instance, 'signed project-only receipt retains identity');
    const credential = await readFile(live.credential_file, 'utf8');
    const session = await http(live.url, '/api/session', { body: {}, headers: { 'x-dashboard-bootstrap': credential } });
    const snapshot = await http(live.url, '/api/snapshot', { headers: { authorization: `Bearer ${session.value.token}` } });
    assert.equal(snapshot.status, 409); assert.equal(snapshot.value.code, 'RUN_NOT_BOUND');
  } finally {
    if (live) await call('stop');
    await f.cleanup();
  }
});

test('ZCode project-only and named project-only run use separate service identities', async () => {
  const f = await fixture(); const cli = join(host, 'cli.mjs'); const projectBinding = f.binding.slice(0, 4);
  const runBinding = [...projectBinding, '--run-id', 'project-only'];
  let projectLive; let runLive;
  const call = binding => processCall([process.execPath, cli, 'start', ...binding, '--python', testPython], '', pythonEnvironment);
  try {
    assert.equal((await processCall(['bash', join(plugin, 'scripts/state/create-run.sh'),
      'project-only', 'Lifecycle namespace regression'], '', { CWD: f.root })).code, 0);
    assert.equal((await f.call('project.mjs', 'init', [])).code, 0);
    const projectStarted = await call(projectBinding); assert.equal(projectStarted.code, 0, projectStarted.stderr);
    projectLive = JSON.parse(projectStarted.stdout);
    const runStarted = await call(runBinding); assert.equal(runStarted.code, 0, runStarted.stderr);
    runLive = JSON.parse(runStarted.stdout);
    assert.notEqual(projectLive.credential_file, runLive.credential_file);
    assert.notEqual(projectLive.identity.instance, runLive.identity.instance);
    assert.notEqual(projectLive.identity.port, runLive.identity.port);
    assert.equal(projectLive.identity.runId, null); assert.equal(runLive.identity.runId, 'project-only');
  } finally {
    if (runLive) await processCall([process.execPath, cli, 'stop', ...runBinding, '--python', testPython], '', pythonEnvironment);
    if (projectLive) await processCall([process.execPath, cli, 'stop', ...projectBinding, '--python', testPython], '', pythonEnvironment);
    await f.cleanup();
  }
});
