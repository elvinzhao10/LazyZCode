import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const plugin = fileURLToPath(new URL('../../../', import.meta.url));
export const host = join(plugin, 'shared/dashboard-host');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const testPython = process.env.LAZYZCODE_TEST_PYTHON ?? 'python3';

export function processCall(argv, input = '', environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', ...environment }, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject); child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ argv, code, signal, stdout, stderr }); });
    child.stdin.end(input);
  });
}

export const pythonEnvironment = testPython.includes('/')
  ? { PATH: `${dirname(testPython)}:${process.env.PATH}` } : {};

export async function fixture(options = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'lazyzcode-dashboard-')));
  const gitEnv = { GIT_CONFIG_NOSYSTEM: '1', HOME: root, ...pythonEnvironment };
  for (const args of [['init', '-q'], ['config', 'user.name', 'ZCode Dashboard QA'], ['config', 'user.email', 'zcode@example.invalid']]) {
    const result = await processCall(['git', '-C', root, ...args], '', gitEnv);
    if (result.code) throw new Error(result.stderr);
  }
  await writeFile(join(root, '.gitignore'), '.lazyzcode/\n');
  await processCall(['git', '-C', root, 'add', '.gitignore'], '', gitEnv);
  await processCall(['git', '-C', root, 'commit', '-qm', 'fixture'], '', gitEnv);
  const created = await processCall(['bash', join(plugin, 'scripts/state/create-run.sh'), 'probe', 'ZCode dashboard probe'], '', { CWD: root, ...pythonEnvironment });
  if (created.code) throw new Error(created.stderr);
  const run = join(root, '.lazyzcode/runs/probe'); const head = (await processCall(['git', '-C', root, 'rev-parse', 'HEAD'], '', gitEnv)).stdout.trim();
  const adopted = 'ZCode adopted edit';
  const plan = '# ZCode plan\n- [x] [C1] Original ZCode criterion\n';
  const artifact = join(run, 'actual.txt'); const workload = join(host, 'test/workload.mjs');
  const verifyText = options.verifyText ?? adopted;
  const commands = options.commands ?? [[process.execPath, workload, 'write', artifact, adopted], [process.execPath, workload, 'verify', artifact, verifyText]];
  const commandsBytes = `${JSON.stringify(commands)}\n`; const statePath = join(run, 'state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  state.status = 'active'; state.plan_reference = '.lazyzcode/runs/probe/plan.md'; state.plan_revision = 1;
  state._approved_plan_sha256 = digest(plan); state.dashboard_project_id = 'project:zcode';
  state.tasks = [{ id: 'P', title: 'ZCode dashboard parent', status: 'running', depends_on: [], execution_authority: {
    repo_head: head, criterion_ids: ['C1'], plan_reference: state.plan_reference, plan_sha256: digest(plan),
    plan_commands_path: '.lazyzcode/runs/probe/commands.json', plan_commands_sha256: digest(commandsBytes),
  } }, { id: 'A', title: 'ZCode dashboard child', status: 'queued', depends_on: [], criteria: [{ id: 'C1', task_id: 'A', version: 1,
    requirement: 'Original ZCode criterion', applicability: 'required', verification: 'unverified', scenarios: [], result_ids: [], history: [] }] }];
  await mkdir(join(run, 'checkpoints'), { recursive: true });
  await Promise.all([writeFile(join(run, 'plan.md'), plan), writeFile(join(run, 'checkpoints/plan-revision.md'), plan),
    writeFile(join(run, 'commands.json'), commandsBytes), writeFile(statePath, JSON.stringify(state))]);
  const binding = ['--project-root', root, '--project-id', 'project:zcode', '--run-id', 'probe', '--actor', 'test:zcode'];
  const call = (entry, action, args = [], input = '') => processCall([process.execPath, join(host, entry), action, ...binding, ...args], input, pythonEnvironment);
  const bridge = (action, payload) => processCall([testPython, join(plugin, 'scripts/state/dashboard-bridge.py'), action,
    ...binding, '--node', process.execPath], JSON.stringify(payload), pythonEnvironment);
  return { root, run, statePath, artifact, binding, call, bridge, cleanup: () => rm(root, { recursive: true }) };
}

export const runCommand = (operation, revision, payload, target = 'A', id = `${operation}:${revision}`) => ({
  schema_version: 1, command_id: id, target: { project_id: 'project:zcode', run_id: 'probe', id: target }, expected_revision: revision, operation, payload,
});

export const queueCommand = (operation, revision, payload, target, id = `${operation}:${revision}`) => ({
  schema_version: 1, command_id: id, target: { project_id: 'project:zcode', run_id: null, id: target }, expected_revision: revision, operation, payload,
});
