#!/usr/bin/env node
// ZCode native project route over the vendored shared project family. Raw
// `init|read|command` reuse the vendored CLI verbatim; `observe` is ZCode's
// T09-equivalent telemetry route and records activity observations read back
// from ZCode's own bounded producer evidence (the immutable producer-attempt
// manifests in the run store plus the run event ledger, and verifier
// publication from the completion authority receipts). The capability/source
// actions are the typed tool surface chat and the status-dashboard MCP bind:
// a not-initialized repository answers with a typed hint whose init offer is
// a question, never an action, and this surface never initializes a project.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CAPABILITY_OPERATIONS, SOURCE_OPERATIONS, assertProjectCommand,
  ProjectContractError } from '../project/contract.mjs';
import { recordObservations } from '../project/model.mjs';
import { ProjectBridgeError, executeProjectCommand, initProject, readProject } from '../project/cli.mjs';

const LIMIT = 8 * 1024 * 1024;
const bridge = fileURLToPath(new URL('../../scripts/state/project-dashboard-bridge.py', import.meta.url));
export const TOOL_ACTIONS = Object.freeze([...CAPABILITY_OPERATIONS, ...SOURCE_OPERATIONS, 'project.context']);
export const ACTIVITY_OBSERVER = 'lazyzcode-dashboard-host/activity@1';
export const VERIFIER_OBSERVER = 'lazyzcode-dashboard-host/verifier-publication@1';
export const CONVERSATIONAL_TELEMETRY_UNAVAILABLE =
  Object.freeze({ status: 'unavailable', reason: 'NOT_REPORTED_BY_PRODUCER' });
const ACTIVITY_SCHEMA = 'lazyzcode.producer-attempt-activity.v1';
const PUBLICATION_SCHEMA = 'lazyzcode.verifier-publication.v1';
const ACTIONS = ['init', 'read', 'command', 'observe', ...TOOL_ACTIONS];
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');

function invokeBridge(action, options, value = {}) {
  const argv = [bridge, action, '--project-root', options.projectRoot, '--project-id', options.projectId,
    '--actor', options.actor, '--node', process.execPath];
  if (argv.some(item => typeof item !== 'string' || !item)) return Promise.reject(new ProjectBridgeError('MISSING_ADAPTER_BINDING'));
  return new Promise((resolve, reject) => {
    const child = spawn(options.python ?? 'python3', argv, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let overflow = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 45000);
    child.stdout.on('data', data => { stdout += data; if (Buffer.byteLength(stdout) > LIMIT) { overflow = true; child.kill('SIGKILL'); } });
    child.stderr.on('data', data => { stderr += data; if (Buffer.byteLength(stderr) > LIMIT) { overflow = true; child.kill('SIGKILL'); } });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 || overflow) { reject(new ProjectBridgeError(overflow ? 'BRIDGE_OUTPUT_LIMIT' : (stderr.trim() || `BRIDGE_EXIT_${code}`))); return; }
      try { resolve(JSON.parse(stdout)); } catch { reject(new ProjectBridgeError('INVALID_BRIDGE_OUTPUT')); }
    });
    child.stdin.end(typeof value === 'string' ? value : JSON.stringify(value));
  });
}

async function stdinText() {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > LIMIT) throw new ProjectBridgeError('INPUT_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function boundedJSON(file) {
  let stat;
  try { stat = await lstat(file); } catch { return null; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMIT) throw new ProjectBridgeError('UNSAFE_ACTIVITY_EVIDENCE');
  return JSON.parse(await readFile(file, 'utf8'));
}

async function boundedText(file) {
  let stat;
  try { stat = await lstat(file); } catch { return null; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMIT) throw new ProjectBridgeError('UNSAFE_ACTIVITY_EVIDENCE');
  return readFile(file, 'utf8');
}

async function attemptEvents(runRoot) {
  const ledger = await boundedText(`${runRoot}/canonical-events.jsonl`);
  if (ledger === null) return null;
  const events = new Map();
  for (const line of ledger.split('\n')) {
    if (!line) continue;
    const event = JSON.parse(line);
    const identity = event.event_id;
    if (typeof identity !== 'string' || !identity.startsWith('producer:')) continue;
    const phase = identity.endsWith(':terminal') ? 'terminal' : identity.endsWith(':start') ? 'start' : null;
    if (!phase) continue;
    const attemptId = identity.slice('producer:'.length, identity.length - (phase === 'start' ? 6 : 9));
    const entry = events.get(attemptId) ?? {};
    entry[phase] = event;
    events.set(attemptId, entry);
  }
  return events;
}

// Observation inputs derived from recorded native evidence only. An attempt is
// identified by the run event ledger and read back through the immutable
// producer-attempt manifests; a dispatched attempt without a terminal record
// renders stale once its last observed heartbeat passes the threshold — never
// running, never a terminal outcome. Verifier publication is observed only
// where the completion authority actually published a receipt.
export async function producerAttemptObservations(options) {
  for (const name of ['projectRoot', 'runId', 'observedAt']) {
    if (typeof options?.[name] !== 'string' || !options[name]) throw new ProjectBridgeError('INVALID_ARGUMENTS');
  }
  if (!Number.isFinite(Date.parse(options.observedAt))) throw new ProjectBridgeError('INVALID_ARGUMENTS');
  const asOf = Date.parse(options.asOf ?? options.observedAt);
  const staleAfterMs = options.staleAfterMs ?? 60000;
  const runRoot = path.join(options.projectRoot, '.lazyzcode', 'runs', options.runId);
  const events = await attemptEvents(runRoot);
  if (events === null || events.size === 0) throw new ProjectBridgeError('ACTIVITY_NOT_OBSERVED');
  const records = [];
  for (const [attemptId, entry] of events) {
    const directory = path.join(runRoot, 'producer-attempts', hash(attemptId));
    const start = await boundedJSON(path.join(directory, 'start.json'));
    if (start === null || entry.start === undefined) throw new ProjectBridgeError('ACTIVITY_NOT_OBSERVED');
    const terminal = await boundedJSON(path.join(directory, 'terminal.json'));
    if (terminal !== null && entry.terminal === undefined) throw new ProjectBridgeError('ACTIVITY_EVIDENCE_INCONSISTENT');
    const interval = { start: start.started_at ?? null, end: terminal?.finished_at ?? null, end_observed: Boolean(terminal) };
    const heartbeat = Math.max(Date.parse(entry.start.ts) || 0, Date.parse(start.started_at) || 0);
    let liveness; let state;
    if (terminal) { liveness = 'terminated'; state = terminal.result?.status === 'pass' ? 'finished' : 'failed'; }
    else if (asOf - heartbeat > staleAfterMs) { liveness = 'unknown'; state = 'stale'; }
    else { liveness = 'observed'; state = 'executing'; }
    const payload = {
      schema_version: ACTIVITY_SCHEMA,
      role: 'unreported',
      agent: { id: start.worker_id, role: 'unreported' },
      session: { id: `producer-session:${start.runner_pid}`, basis: 'process', pid: start.runner_pid ?? null },
      attempt: { id: attemptId, task_id: start.task_id ?? null, criterion_id: start.criterion_id ?? null,
        criterion_version: start.criterion_version ?? null, plan_revision: start.plan_revision ?? null,
        consumed_plan_revision: start.plan_revision ?? null, resumes_attempt: null,
        resume_relation: null, resume_basis: null },
      step: { id: null, command_index: null, argv_sha256: start.argv_sha256 ?? null },
      activity: { state, liveness, interval, waiting: null, duration_basis: 'recorded-session-duration',
        live_conversational_agent: false },
      delivery: {
        dispatch: { status: 'published', event_id: entry.start.event_id, published_at: entry.start.ts,
          manifest: `.lazyzcode/runs/${options.runId}/producer-attempts/${hash(attemptId)}/start.json` },
        ack: { status: 'observed', runner_pid: start.runner_pid ?? null, acked_at: start.started_at ?? null },
        consumption: terminal ? { status: 'observed', result_status: terminal.result?.status ?? null,
          process_exit_code: terminal.process_exit_code ?? null, process_signal: terminal.process_signal ?? null,
          finished_at: terminal.finished_at ?? null } : { status: 'unobserved' },
      },
      conversational_telemetry: CONVERSATIONAL_TELEMETRY_UNAVAILABLE,
    };
    records.push({
      id: `observation:attempt:${options.runId}:${attemptId}`,
      subject: { kind: 'run', id: options.runId }, classification: 'observed',
      observed_by: ACTIVITY_OBSERVER, observed_at: options.observedAt,
      provenance: { kind: 'native_event',
        reference: `run:${options.runId}#producer-attempts/${hash(attemptId)}/${terminal ? 'start+terminal' : 'start'}@${entry.start.event_id}` },
      content_revision: start.source_revision ?? null,
      text: JSON.stringify(payload),
    });
  }
  return records;
}

// Verifier publication is observed from ZCode's completion authority: each
// completed criterion names the immutable receipt its distinct verifier
// published. An unreadable receipt leaves that publication unobserved; it is
// never inferred from a checked box or a file write.
export async function verifierPublicationObservations(options) {
  for (const name of ['projectRoot', 'runId', 'observedAt']) {
    if (typeof options?.[name] !== 'string' || !options[name]) throw new ProjectBridgeError('INVALID_ARGUMENTS');
  }
  const runRoot = path.join(options.projectRoot, '.lazyzcode', 'runs', options.runId);
  const authority = await boundedJSON(path.join(runRoot, 'completion-authority.json'));
  if (authority === null) return [];
  const records = [];
  for (const criterion of authority.criteria ?? []) {
    if (criterion?.status !== 'complete' || typeof criterion.evidence_path !== 'string') continue;
    const receipt = await boundedJSON(path.join(runRoot, criterion.evidence_path.replace(/^\.lazyzcode\/runs\/[^/]+\//, '')));
    if (receipt === null) continue;
    records.push({
      id: `observation:verifier:${options.runId}:${criterion.task_id}:${criterion.criterion_id}`,
      subject: { kind: 'run', id: options.runId }, classification: 'observed',
      observed_by: VERIFIER_OBSERVER, observed_at: options.observedAt,
      provenance: { kind: 'native_event',
        reference: `run:${options.runId}#${criterion.evidence_path}@${criterion.criterion_version}` },
      content_revision: receipt.repo_head ?? null,
      text: JSON.stringify({ schema_version: PUBLICATION_SCHEMA, task_id: criterion.task_id,
        criterion_id: criterion.criterion_id, criterion_version: criterion.criterion_version,
        verifier: { identity: receipt.verifier?.identity ?? null, attempt: null },
        executor: { identity: receipt.executor?.identity ?? null },
        verdict: receipt.review?.verdict ?? null, command: receipt.command ?? null,
        artifact: receipt.artifact ?? null, package_version: receipt.package_version ?? null,
        conversational_telemetry: CONVERSATIONAL_TELEMETRY_UNAVAILABLE }),
    });
  }
  return records;
}

const notInitialized = action => ({
  schema_version: 1, status: 'not_initialized', operation: action,
  hint: 'PROJECT_NOT_INITIALIZED', initialized: false,
  init_offer: { kind: 'question',
    question: 'No project record is initialized for this repository. Ask the user whether to run the explicit project init command; this tool never creates or initializes a project.' },
});

const invalid = (action, reason) => ({ schema_version: 1, status: 'invalid', operation: action, reason, initialized: true });

const deliveryReceipt = () => ({
  channel: 'shared-command-route', native_delivery: 'unobserved', consumed_by_native: false,
  basis: 'delivery and consumption are reported by the native runtime only; never inferred from file writes',
});

const tally = (values, accessor) => Object.fromEntries([...new Set(values.map(value => accessor(value)))]
  .sort().map(state => [state, values.filter(value => accessor(value) === state).length]));

function contextSummary(snapshot) {
  const plans = snapshot.plans ?? [];
  return {
    schema_version: 1, kind: 'project-context',
    project: { project_id: snapshot.project_id, runtime: snapshot.runtime,
      revision: snapshot.revision, baseline_revision: snapshot.baseline_revision,
      observation_revision: snapshot.observation_revision ?? 0 },
    sources: { total: (snapshot.sources ?? []).length,
      by_observation_status: tally(snapshot.sources ?? [], source => source.observation.status) },
    plans: { total: plans.length, by_lifecycle: tally(plans, plan => plan.declared_lifecycle),
      stale_reference_plan_ids: plans.filter(plan => plan.baseline_reference_status === 'stale').map(plan => plan.id),
      observed_native_runs: plans.reduce((total, plan) => total + (plan.native_observations ?? []).length, 0) },
    artifacts: { total: (snapshot.artifacts ?? []).length },
    boundaries: { native_delivery: 'unobserved', host_wake: 'unclaimed',
      mcp_mode_gate: 'status-dashboard profile gate applies before any project tool',
      git_observation: 'vendored collectors byte-pinned but not wired to any ZCode-exposed route; commit links are run-side repo_head/content_revision only',
      consumption: 'reported by the native runtime only; never inferred from file writes' },
  };
}

function composeCommand(action, projectId, request) {
  const value = request === undefined || request === null ? {} : request;
  const command = { schema_version: 1, command_id: value.command_id, project_id: projectId,
    expected_revision: value.expected_revision, operation: action, payload: value.payload ?? {} };
  assertProjectCommand(command);
  return command;
}

function typedFailure(action, error) {
  if (error instanceof ProjectBridgeError && error.code === 'PROJECT_NOT_INITIALIZED') return notInitialized(action);
  if (error instanceof ProjectBridgeError || error instanceof ProjectContractError) return invalid(action, error.code);
  throw error;
}

export async function executeProjectTool({ projectRoot, projectId, actor, action, request, python }) {
  if (!TOOL_ACTIONS.includes(action)) throw new ProjectBridgeError('UNKNOWN_TOOL_ACTION');
  if (typeof request !== 'object' && request !== undefined && request !== null) {
    throw new ProjectBridgeError('INVALID_TOOL_REQUEST');
  }
  const envelope = outcome => ({ schema_version: 1, tool: 'project', action, route: 'shared-command-route',
    delivery: deliveryReceipt(), ...outcome });
  if (action === 'project.context') {
    let snapshot;
    try { snapshot = await readProject({ projectRoot, projectId, actor }); }
    catch (error) { return envelope({ result: typedFailure(action, error) }); }
    return envelope({ result: { schema_version: 1, status: 'ok', operation: 'project.context', initialized: true,
      project_id: snapshot.project_id, summary: contextSummary(snapshot) } });
  }
  let command;
  try { command = composeCommand(action, projectId, request); }
  catch (error) { return envelope({ result: typedFailure(action, error) }); }
  let outcome;
  try { outcome = await executeProjectCommand({ projectRoot, projectId, actor }, command); }
  catch (error) { return envelope({ result: typedFailure(action, error) }); }
  const response = {};
  if (outcome.result !== undefined) response.result = outcome.result;
  if (outcome.receipt) response.receipt = outcome.receipt;
  response.snapshot = outcome.snapshot;
  return envelope(response);
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === '--observe-reduce') {
    // Pure reducer entry for the native bridge: applies the vendored T02
    // observation route. It grants no authority and appends no receipts.
    let input;
    try { input = JSON.parse(await stdinText()); }
    catch { throw new ProjectBridgeError('INVALID_JSON'); }
    if (typeof input !== 'object' || input === null) throw new ProjectBridgeError('INVALID_OBSERVATIONS');
    const outcome = recordObservations(input.state, input.records);
    const output = JSON.stringify(outcome);
    if (Buffer.byteLength(output) > LIMIT) throw new ProjectBridgeError('OUTPUT_TOO_LARGE');
    process.stdout.write(`${output}\n`);
    return;
  }
  const [action, ...arguments_] = argv;
  if (!ACTIONS.includes(action)) throw new ProjectBridgeError('INVALID_ACTION');
  const names = { '--project-root': 'projectRoot', '--project-id': 'projectId', '--actor': 'actor',
    '--python': 'python', '--run-id': 'runId', '--observed-at': 'observedAt', '--stale-after-ms': 'staleAfterMs' };
  const options = {};
  if (arguments_.length % 2) throw new ProjectBridgeError('INVALID_ARGV');
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = names[arguments_[index]];
    if (!key || options[key] !== undefined) throw new ProjectBridgeError('INVALID_ARGV');
    options[key] = arguments_[index + 1];
  }
  for (const name of ['projectRoot', 'projectId', 'actor']) {
    if (typeof options[name] !== 'string' || !options[name]) throw new ProjectBridgeError('INVALID_ARGV');
  }
  if (action === 'init' || action === 'read') {
    const invoke = action === 'init' ? initProject : readProject;
    const result = await invoke({ projectRoot: options.projectRoot, projectId: options.projectId, actor: options.actor });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (action === 'command') {
    const command = await stdinText();
    if (!command.trim()) throw new ProjectBridgeError('INVALID_COMMAND');
    const result = await executeProjectCommand({ projectRoot: options.projectRoot, projectId: options.projectId,
      actor: options.actor }, JSON.parse(command));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (action === 'observe') {
    if (typeof options.runId !== 'string' || !options.runId) throw new ProjectBridgeError('INVALID_ARGV');
    const observedAt = options.observedAt ?? new Date().toISOString();
    const staleAfterMs = options.staleAfterMs !== undefined ? Number(options.staleAfterMs) : undefined;
    if (staleAfterMs !== undefined && !Number.isInteger(staleAfterMs)) throw new ProjectBridgeError('INVALID_ARGV');
    const shared = { projectRoot: options.projectRoot, runId: options.runId, observedAt };
    const records = [...await producerAttemptObservations({ ...shared,
      ...(staleAfterMs === undefined ? {} : { staleAfterMs }) }),
      ...await verifierPublicationObservations(shared)];
    const result = await invokeBridge('observe', options, records);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  let request;
  const text = await stdinText();
  if (text.trim()) {
    try { request = JSON.parse(text); }
    catch { throw new ProjectBridgeError('INVALID_JSON'); }
  }
  const response = await executeProjectTool({ ...options, action, request });
  const output = JSON.stringify(response);
  if (Buffer.byteLength(output) > 16 * 1024 * 1024) throw new ProjectBridgeError('OUTPUT_TOO_LARGE');
  process.stdout.write(`${output}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    const code = typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/.test(error.code) ? error.code : 'PROJECT_ROUTE_FAILED';
    process.stderr.write(`${code}\n`);
    process.exitCode = 65;
  });
}
