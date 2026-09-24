'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const pluginRoot = path.resolve(__dirname, '..');
const hooksFile = path.join(pluginRoot, 'hooks', 'hooks.json');
const dispatcher = path.join(pluginRoot, 'scripts', 'hooks', 'lifecycle-event.js');
const fixtureRoot = path.join(__dirname, 'fixtures', 'hook-events');
const contract = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'contracts', 'zcode-hook-consumers.v1.json'), 'utf8'));
const temporaryProjects = [];

// ZCode's exactly-seven hook events and their LazyZCode handler commands.
const zcodeHandlers = Object.freeze({
  SessionStart: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/session-start.sh"',
  UserPromptSubmit: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/user-prompt-submit.sh"',
  PreToolUse: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pre-tool-use.sh"',
  PermissionRequest: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/lifecycle-event.js"',
  PostToolUse: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/post-tool-use.sh"',
  PostToolUseFailure: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/post-tool-use-failure.sh"',
  Stop: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/stop-gate.sh"',
});

test.after(() => {
  for (const projectDir of temporaryProjects) fs.rmSync(projectDir, { recursive: true, force: true });
});

function readHooks() {
  return JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
}

function hookCommand(declaration, event) {
  return declaration.hooks[event][0].hooks[0].command;
}

function fixture(name, projectDir) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8').replaceAll('${PROJECT_DIR}', projectDir));
}

function setupProject(status = 'executing') {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazyzcode-hook-event-'));
  temporaryProjects.push(projectDir);
  const runDir = path.join(projectDir, '.lazyzcode', 'runs', 'run-001');
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'state.json'), `${JSON.stringify({ status, progress: { completed_count: 2 } }, null, 2)}\n`);
  return { projectDir, runDir };
}

function dispatch(event, payload, projectDir, maxBuffer = 256 * 1024) {
  return spawnSync(process.execPath, [dispatcher], {
    cwd: projectDir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    input: `${JSON.stringify({ ...payload, hook_event_name: event })}\n`,
    encoding: 'utf8',
    maxBuffer,
    timeout: 3_000,
  });
}

function recordedEvents(projectDir) {
  const root = path.join(projectDir, '.lazyzcode', 'hook-events');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true })
    .map(name => path.join(root, name.toString()))
    .filter(file => file.endsWith('.json'));
}

test('declares exactly the seven ZCode hook events with one handler command each', () => {
  // Given: the ZCode hook declaration and the ZCode hook-consumer contract.
  const declaration = readHooks();
  const events = Object.keys(declaration.hooks);

  // Then: the event set matches ZCode's documented seven-event surface and the contract.
  assert.deepEqual(new Set(events), new Set(Object.keys(zcodeHandlers)));
  assert.deepEqual(new Set(Object.keys(contract.events)), new Set(Object.keys(zcodeHandlers)));
  for (const [event, command] of Object.entries(zcodeHandlers)) {
    assert.equal(hookCommand(declaration, event), command, `${event} handler drifted`);
  }
  assert.match(declaration.hooks.PreToolUse[0].matcher, /Write\|Edit\|Bash/);
  assert.match(declaration.hooks.SessionStart[0].matcher, /startup\|resume\|clear\|compact/);
  assert.ok(typeof declaration._lazyzcode === 'string' && declaration._lazyzcode.includes('advisory'));
});

test('hook timeouts and payload boundary match the shared ZCode contract', () => {
  const declaration = readHooks();
  const timeoutFor = (event) => declaration.hooks[event][0].hooks[0].timeout;
  assert.equal(timeoutFor('SessionStart'), 10);
  assert.equal(timeoutFor('UserPromptSubmit'), 10);
  assert.equal(timeoutFor('PreToolUse'), contract.boundary.timeout_seconds);
  assert.equal(timeoutFor('PermissionRequest'), contract.boundary.timeout_seconds);
  assert.equal(timeoutFor('PostToolUse'), 10);
  assert.equal(timeoutFor('PostToolUseFailure'), 10);
  assert.equal(timeoutFor('Stop'), 10);
  assert.equal(contract.boundary.max_payload_bytes, 65_536);
  assert.deepEqual(contract.boundary.exit_codes, { accepted: 0, rejected: 2, internal_error: 70 });
  assert.deepEqual(contract.boundary.required_common_fields, ['session_id', 'cwd', 'hook_event_name']);
  assert.deepEqual(contract.boundary.omitted_common_fields, ['transcript_path']);
});

test('records an advisory normalized permission request without stdout output', () => {
  // Given: an active run and the documented PermissionRequest fixture.
  const { projectDir } = setupProject();
  const payload = fixture('PermissionRequest', projectDir);

  // When: the event crosses the real dispatcher boundary.
  const result = dispatch('PermissionRequest', payload, projectDir);

  // Then: the hook prints nothing, exits 0, and persists one advisory record.
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  const records = recordedEvents(projectDir);
  assert.equal(records.length, 1);
  const record = JSON.parse(fs.readFileSync(records[0], 'utf8'));
  assert.equal(record.raw_event, 'PermissionRequest');
  assert.equal(record.canonical_event, 'permission-request');
  assert.equal(record.consumer.name, 'permission-audit');
  assert.equal(record.consumer.mode, 'advisory');
  assert.equal(record.consumer.completion_authority, false);
  assert.equal(record.payload.request_id, 'perm-001');
  assert.equal(record.payload.tool_name, 'Bash');
});

test('omits transcript paths and redacts secret-like fields from persisted records', () => {
  // Given: a permission request carrying a transcript path and secret-shaped key/value.
  const { projectDir } = setupProject('complete');
  const payload = fixture('PermissionRequest', projectDir);
  payload.transcript_path = '/private/tmp/session.jsonl';
  payload.api_key = 'sk-abcdefghijklmnopqrstuvwxyz123456';
  payload.reason = 'Run the suite. Bearer abcdefghijklmnopqrstuvwxyz';

  // When: the dispatcher normalizes the payload.
  const result = dispatch('PermissionRequest', payload, projectDir);
  const records = recordedEvents(projectDir);
  const record = JSON.parse(fs.readFileSync(records[0], 'utf8'));
  const serialized = JSON.stringify(record);

  // Then: secrets and transcripts never reach the record and the hook still exits cleanly.
  assert.equal(result.status, 0);
  assert.equal(record.payload.transcript_path, undefined);
  assert.equal(record.payload.api_key, undefined);
  assert.equal(serialized.includes('sk-abcdefghijklmnopqrstuvwxyz'), false);
  assert.equal(serialized.includes('abcdefghijklmnopqrstuvwxyz'), false);
  assert.equal(serialized.includes('session.jsonl'), false);
});

test('repeated delivery is idempotent and permission events never complete work', () => {
  // Given: an active run whose progress is incomplete and one permission request delivery.
  const { projectDir, runDir } = setupProject();
  const payload = fixture('PermissionRequest', projectDir);

  // When: the identical event is delivered twice.
  const first = dispatch('PermissionRequest', payload, projectDir);
  const duplicate = dispatch('PermissionRequest', payload, projectDir);
  const state = JSON.parse(fs.readFileSync(path.join(runDir, 'state.json'), 'utf8'));

  // Then: only one record exists, the hook exits 0 both times, and completion-bearing state is untouched.
  assert.equal(first.status, 0);
  assert.equal(duplicate.status, 0);
  assert.equal(recordedEvents(projectDir).length, 1);
  assert.equal(state.status, 'executing');
  assert.deepEqual(state.progress, { completed_count: 2 });
  assert.equal(state.hook_lifecycle.last_permission.outcome, 'requested');
  assert.equal(state.hook_lifecycle.last_permission.completion_authority, false);
});

test('refuses malformed oversized incomplete and unsupported payloads with typed stderr and exit 0', () => {
  // Given: hostile inputs spanning the dispatcher boundary.
  const { projectDir } = setupProject();
  const cases = [
    ['malformed_json', '{not-json'],
    ['payload_too_large', JSON.stringify({ ...fixture('PermissionRequest', projectDir), reason: 'x'.repeat(70 * 1024) })],
    ['missing_event_field', JSON.stringify({ ...fixture('PermissionRequest', projectDir), request_id: undefined })],
    ['missing_common_field', JSON.stringify({ ...fixture('PermissionRequest', projectDir), session_id: undefined })],
    ['unsupported_event', JSON.stringify({ ...fixture('PermissionRequest', projectDir), hook_event_name: 'PostCompact' })],
  ];

  // When/Then: every hostile payload is refused with a typed reason, no stdout, exit 0.
  for (const [reason, input] of cases) {
    const result = spawnSync(process.execPath, [dispatcher], {
      cwd: projectDir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      input,
      encoding: 'utf8',
      timeout: 3_000,
    });
    assert.equal(result.status, 0, `${reason} must stay advisory`);
    assert.equal(result.stdout, '', `${reason} must not print to stdout`);
    assert.equal(JSON.parse(result.stderr).reason, reason);
  }
});
