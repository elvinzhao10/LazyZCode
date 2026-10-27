import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, processCall, plugin } from './fixture.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { authorityFor } from '../service-adapter.mjs';

test('LazyZCode telemetry reads its real native bound run and keeps absent usage unavailable', async () => {
  const f = await fixture();
  try {
    const initialized = await f.call('project.mjs', 'init', []);
    assert.equal(initialized.code, 0, initialized.stderr);
    const result = await authorityFor({}).readProjectTelemetry({ projectRoot: f.root, projectId: 'project:zcode', runId: 'probe' }, 'test:telemetry');
    assert.equal(result.project_id, 'project:zcode');
    assert.equal(result.run_id, 'probe');
    assert.equal(result.tasks.total, 2);
    assert.equal(result.usage, null);
    const statePath = join(f.run, 'state.json'); const state = JSON.parse(await readFile(statePath, 'utf8'));
    state.status = 'executing'; await writeFile(statePath, JSON.stringify(state));
    const hookResult = await processCall(['bash', join(plugin, 'scripts/hooks/post-tool-use.sh')], JSON.stringify({ cwd: f.root, tool_name: 'mcp__docs__search' }), { CWD: f.root });
    assert.equal(hookResult.code, 0, hookResult.stderr);
    const afterHook = await authorityFor({}).readProjectTelemetry({ projectRoot: f.root, projectId: 'project:zcode', runId: 'probe' }, 'test:telemetry');
    assert.ok(afterHook.monitor.trace.some(entry => entry.kind === 'mcp' && entry.name === 'mcp__docs__search'));
    assert.equal(afterHook.run_id, 'probe');
    const health = await authorityFor({}).readProjectHealth();
    assert.ok(health.inventory.entries.some(entry => entry.kind === 'subagent'));
    assert.ok(health.inventory.entries.every(entry => entry.runtime_state === 'unobserved'));
  } finally { await f.cleanup(); }
});
