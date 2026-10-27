import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, processCall, plugin, testPython } from './fixture.mjs';
import { capture, evidence } from '../service-snapshot.mjs';
import { zcodeAuthority } from '../service-adapter.mjs';

test('snapshot, evidence and telemetry stay bound to the selected run and reject a mismatched state', async () => {
  const f = await fixture();
  try {
    const initialized = await f.call('project.mjs', 'init', []);
    assert.equal(initialized.code, 0, initialized.stderr);
    const created = await processCall(['bash', join(plugin, 'scripts/state/create-run.sh'), 'newer', 'New active run'], '', { CWD: f.root });
    assert.equal(created.code, 0, created.stderr);
    await mkdir(join(f.root, '.lazyzcode/state'), { recursive: true });
    await writeFile(join(f.root, '.lazyzcode/state/active-loop.json'), JSON.stringify({ run_id: 'newer' }));
    const state = JSON.parse(await readFile(f.statePath, 'utf8'));
    const path = '.lazyzcode/runs/probe/actual.txt';
    state.tasks[0].evidence = [path];
    await writeFile(f.statePath, JSON.stringify(state));
    await writeFile(f.artifact, 'bound-run evidence');
    const options = { projectRoot: f.root, projectId: 'project:zcode', runId: 'probe', python: testPython };
    const current = await capture(options);
    assert.equal(current.snapshot.run_id, 'probe');
    const reference = current.evidence.find(item => item.path === path);
    assert.ok(reference);
    assert.equal(String(await evidence(options, reference.id)), 'bound-run evidence');
    const telemetry = await zcodeAuthority.readProjectTelemetry(options, 'test:binding');
    assert.equal(telemetry.run_id, 'probe');
    state.run_id = 'newer';
    await writeFile(f.statePath, JSON.stringify(state));
    await assert.rejects(capture(options), /identity mismatch/);
    await assert.rejects(evidence(options, reference.id), /identity mismatch/);
    const rejected = await zcodeAuthority.readProjectTelemetry(options, 'test:binding');
    assert.equal(rejected.run_id, null);
    assert.equal(rejected.monitor.available, false);
  } finally { await f.cleanup(); }
});
