import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, host, processCall, pythonEnvironment, queueCommand, runCommand, testPython } from './fixture.mjs';
import { zcodeAuthority } from '../service-adapter.mjs';

async function context(f, attempt, worker, index) {
  const result = await f.call('producers.mjs', 'context', ['--parent-task-id', 'P', '--task-id', 'A', '--criterion-id', 'C1',
    '--attempt-id', attempt, '--worker-id', worker, '--plan-commands-file', join(f.run, 'commands.json'), '--command-index', String(index), '--python', testPython]);
  assert.equal(result.code, 0, result.stderr); const path = join(f.run, `${attempt.replace(':', '-')}.json`); await writeFile(path, result.stdout); return path;
}
async function http(origin, path, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = request(`${origin}${path}`, { method: options.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { ...(body === undefined ? {} : { origin, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }), ...options.headers }, timeout: 10000 }, response => {
      let text = ''; response.on('data', chunk => { text += chunk; }); response.on('end', () => {
        try { resolve({ status: response.statusCode, value: JSON.parse(text) }); } catch { resolve({ status: response.statusCode, value: text }); }
      });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('HTTP_TIMEOUT'))); req.end(body);
  });
}
const completion = (planRevision, sourceRevision, criterionVersion = 2) => ({ task_id: 'A', criterion_id: 'C1', criterion_version: criterionVersion, plan_revision: planRevision,
  source_revision: sourceRevision, artifact_path: '.lazyzcode/runs/probe/actual.txt', executor_id: 'worker:zcode-executor',
  executor_attempt_id: 'executor:zcode', verifier_id: 'worker:zcode-verifier', verifier_attempt_id: 'verifier:zcode', package_version: '1.3.5' });

test('ZCode native edit stays pending until an exact revision is consumed and a distinct verifier proves it', async () => {
  const f = await fixture();
  try {
    const before = await zcodeAuthority.read({ projectRoot: f.root, projectId: 'project:zcode', runId: 'probe', python: testPython });
    const edited = runCommand('amend_criterion', before.revision, { criterion_id: 'C1', expected_version: 1, requirement: 'ZCode adopted edit' }, 'A', 'edit:zcode');
    const saved = await f.call('commands.mjs', 'command', ['--python', testPython], JSON.stringify(edited));
    assert.equal(saved.code, 0, saved.stderr); assert.equal(JSON.parse(saved.stdout).status, 'pending_agent');
    let state = JSON.parse(await readFile(f.statePath, 'utf8')); assert.equal(state.acknowledgements[0].status, 'pending_agent');
    const executorContext = await context(f, 'executor:zcode', 'worker:zcode-executor', 0);
    const executed = await f.call('producers.mjs', 'execute', ['--context-file', executorContext,
      '--artifact-path', '.lazyzcode/runs/probe/actual.txt', '--python', testPython]);
    assert.equal(executed.code, 0, executed.stderr || executed.stdout);
    state = JSON.parse(await readFile(f.statePath, 'utf8')); assert.equal(state.acknowledgements[0].status, 'applied');
    const verifierContext = await context(f, 'verifier:zcode', 'worker:zcode-verifier', 1);
    const verified = await f.call('producers.mjs', 'verify', ['--context-file', verifierContext,
      '--artifact-path', '.lazyzcode/runs/probe/actual.txt', '--executor-id', 'worker:zcode-executor',
      '--executor-attempt-id', 'executor:zcode', '--python', testPython]);
    assert.equal(verified.code, 0, verified.stderr || verified.stdout);
    const input = await zcodeAuthority.read({ projectRoot: f.root, projectId: 'project:zcode', runId: 'probe', python: testPython });
    const snapshot = await zcodeAuthority.project(input); const task = snapshot.tasks.find(item => item.id === 'A');
    assert.equal(task.progress.verified, 1); assert.equal(task.criteria[0].requirement, 'ZCode adopted edit');
    assert.deepEqual(task.attempts.map(item => item.worker_id), ['worker:zcode-executor', 'worker:zcode-verifier']);
    assert.notEqual(JSON.parse(await readFile(executorContext, 'utf8')).worker_id, JSON.parse(await readFile(verifierContext, 'utf8')).worker_id);
    const stale = await f.bridge('complete', completion(input.plan_revision + 1, input.source_revision));
    assert.notEqual(stale.code, 0); assert.match(stale.stderr, /stale/);
    assert.equal(await readFile(join(f.run, 'completion-authority.json'), 'utf8').then(() => true, () => false), true);
  } finally { await f.cleanup(); }
});

test('ZCode failed and cancelled executions never publish verification', async () => {
  const failed = await fixture({ verifyText: 'Different ZCode expectation' });
  try {
    const executorContext = await context(failed, 'executor:zcode', 'worker:zcode-executor', 0);
    const executed = await failed.call('producers.mjs', 'execute', ['--context-file', executorContext,
      '--artifact-path', '.lazyzcode/runs/probe/actual.txt', '--python', testPython]);
    assert.equal(executed.code, 0, executed.stderr || executed.stdout);
    const verifierContext = await context(failed, 'verifier:zcode', 'worker:zcode-verifier', 1);
    const verified = await failed.call('producers.mjs', 'verify', ['--context-file', verifierContext,
      '--artifact-path', '.lazyzcode/runs/probe/actual.txt', '--executor-id', 'worker:zcode-executor',
      '--executor-attempt-id', 'executor:zcode', '--python', testPython]);
    assert.notEqual(verified.code, 0);
    let state = JSON.parse(await readFile(failed.statePath, 'utf8'));
    assert.equal(state.tasks.find(item => item.id === 'A').status, 'failed');
    assert.equal(await readFile(join(failed.run, 'completion-authority.json'), 'utf8').then(() => true, () => false), false);
    const input = await zcodeAuthority.read({ projectRoot: failed.root, projectId: 'project:zcode', runId: 'probe', python: testPython });
    const snapshot = await zcodeAuthority.project(input);
    assert.equal(snapshot.tasks.find(item => item.id === 'A').progress.verified, 0);
  } finally { await failed.cleanup(); }
  const cancelled = await fixture();
  try {
    await writeFile(join(cancelled.run, 'cancel-requested'), '');
    const executorContext = await context(cancelled, 'executor:zcode', 'worker:zcode-executor', 0);
    const executed = await cancelled.call('producers.mjs', 'execute', ['--context-file', executorContext,
      '--artifact-path', '.lazyzcode/runs/probe/actual.txt', '--cancel-file', join(cancelled.run, 'cancel-requested'), '--python', testPython]);
    assert.notEqual(executed.code, 0);
    const state = JSON.parse(await readFile(cancelled.statePath, 'utf8'));
    assert.equal(state.tasks.find(item => item.id === 'A').status, 'cancelled');
    const cancelledInput = await zcodeAuthority.read({ projectRoot: cancelled.root, projectId: 'project:zcode', runId: 'probe', python: testPython });
    const resume = await cancelled.bridge('complete', completion(state.plan_revision, cancelledInput.source_revision, 1));
    assert.notEqual(resume.code, 0); assert.match(resume.stderr, /not current and finished/);
    assert.equal(await readFile(join(cancelled.run, 'completion-authority.json'), 'utf8').then(() => true, () => false), false);
  } finally { await cancelled.cleanup(); }
});

test('ZCode run conflicts and cycles reject without mutation while queue edits persist without execution', async () => {
  const f = await fixture();
  try {
    let input = await zcodeAuthority.read({ projectRoot: f.root, projectId: 'project:zcode', runId: 'probe', python: testPython });
    const first = await f.call('commands.mjs', 'command', ['--python', testPython], JSON.stringify(runCommand('add_dependency', input.revision, { prerequisite_id: 'P' })));
    assert.equal(first.code, 0, first.stderr); assert.equal(JSON.parse(first.stdout).status, 'pending_agent');
    input = await zcodeAuthority.read({ projectRoot: f.root, projectId: 'project:zcode', runId: 'probe', python: testPython });
    const beforeCycle = await readFile(f.statePath, 'utf8');
    const cycle = await f.call('commands.mjs', 'command', ['--python', testPython], JSON.stringify(runCommand('add_dependency', input.revision, { prerequisite_id: 'A' }, 'P')));
    assert.notEqual(cycle.code, 0); assert.match(cycle.stderr, /CYCLE/);
    assert.equal(await readFile(f.statePath, 'utf8'), beforeCycle);
    const stale = await f.call('commands.mjs', 'command', ['--python', testPython], JSON.stringify(runCommand('amend_task', 1, { priority: 9 }, 'A', 'stale:zcode')));
    assert.equal(JSON.parse(stale.stdout).status, 'conflict');
    const plan = { id: 'plan:zcode', project_id: 'project:zcode', title: 'ZCode queued', priority: 1, readiness: 'draft', prerequisites: [], decision_id: null, revision: 0 };
    for (const command of [queueCommand('create_queued_plan', 0, { plan }, 'plan:zcode'),
      queueCommand('amend_queued_plan', 1, { title: 'Chosen ZCode title', priority: 7, readiness: 'ready' }, 'plan:zcode'),
      queueCommand('reorder_queued_plan', 2, { plan_ids: ['plan:zcode'] }, 'queue')]) {
      const result = await f.call('commands.mjs', 'command', ['--python', testPython], JSON.stringify(command));
      assert.equal(result.code, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, 'saved');
    }
    input = await zcodeAuthority.read({ projectRoot: f.root, projectId: 'project:zcode', runId: 'probe', python: testPython });
    assert.equal(input.queue[0].title, 'Chosen ZCode title'); assert.equal(input.queue_revision, 3);
    assert.equal(input.queue_activations.length, 0);
    assert.equal((await readFile(f.statePath, 'utf8')).includes('plan:zcode'), false);
    assert.deepEqual(await readdir(join(f.root, '.lazyzcode/runs')), ['probe']);
  } finally { await f.cleanup(); }
});

test('ZCode owned lifecycle preserves origin and refuses a foreign listener', async () => {
  const f = await fixture(); const cli = join(host, 'cli.mjs'); const binding = f.binding.slice(0, 6); let live;
  const call = action => processCall([process.execPath, cli, action, ...binding, '--python', testPython,
    ...(live?.identity?.port && action === 'start' ? ['--port', String(live.identity.port)] : [])], '', pythonEnvironment);
  try {
    const opened = await call('open'); assert.equal(opened.code, 0, opened.stderr); live = JSON.parse(opened.stdout);
    assert.equal(live.entry, 'browser'); assert.equal(live.capabilities.native_host_readiness, 'pending');
    const credential = await readFile(live.credential_file, 'utf8');
    const session = await http(live.url, '/api/session', { body: {}, headers: { 'x-dashboard-bootstrap': credential } });
    const snapshot = await http(live.url, '/api/snapshot', { headers: { authorization: `Bearer ${session.value.token}` } });
    assert.equal(snapshot.status, 200); assert.equal(snapshot.value.snapshot.project_id, 'project:zcode');
    const port = live.identity.port; assert.equal((await call('status')).code, 0); assert.equal((await call('stop')).code, 0);
    const foreign = createServer((_request, response) => response.end('foreign'));
    await new Promise((resolve, reject) => { foreign.once('error', reject); foreign.listen(port, '127.0.0.1', resolve); });
    try {
      assert.equal((await call('start')).code, 65); const response = await http(`http://127.0.0.1:${port}`, '/'); assert.equal(response.value, 'foreign');
    } finally { await new Promise(resolve => foreign.close(resolve)); }
    const restarted = await call('start'); assert.equal(restarted.code, 0, restarted.stderr); assert.equal(JSON.parse(restarted.stdout).identity.port, port);
  } finally {
    await processCall([process.execPath, cli, 'stop', ...binding, '--python', testPython], '', pythonEnvironment); await f.cleanup();
  }
});
