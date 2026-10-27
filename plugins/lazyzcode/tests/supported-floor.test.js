'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const runner = pathToFileURL(path.join(root, 'scripts/shared/floor-runner.mjs')).href;

for (const args of [[], ['--exercise', 'missing/path'], ['--exercise', ''], ['--exercise', 'package,'], ['--exercise', 'package', '--surface', 'unknown'], ['--exercise', 'package', '--expected-runtime', '0.0.0'], ['--exercise', 'package', '--unknown'], ['--exercise', 'package', '--expect-unsupported']]) {
  test(`rejects invalid options ${JSON.stringify(args)}`, () => {
    // Given a real adapter and malformed CLI input.
    // When invoked as a child process.
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/verify-supported-floor.mjs'), ...args], { encoding: 'utf8' });
    // Then it exits unsuccessfully without a PASS result.
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).verdict, 'FAIL');
    assert.doesNotMatch(result.stdout, /"verdict":"PASS"/);
  });
}

test('propagates a failing exercise child without PASS', () => {
  // Given a named exercise whose real child exits 7.
  const program = `import {verifyFloor} from ${JSON.stringify(runner)}; process.exitCode=verifyFloor({root:process.cwd(),defaultSurface:'core',surfaces:{core:'20.0.0'},exercises:{package:['-e','process.exit(7)']}},['--exercise','package']);`;
  // When the shared runner executes the exercise.
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' });
  // Then the diagnostic preserves the child's failure.
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).details.status, 7);
  assert.doesNotMatch(result.stdout, /"verdict":"PASS"/);
});

for (const [version, expected] of [['22.22.1', false], ['22.22.2', true], ['22.23.0', true], ['20.99.0', false], ['24.0.0', true]]) {
  test(`checks the exact provider version boundary at ${version}`, async () => {
    // Given the provider minimum version.
    const { meetsFloor } = await import(runner);
    // When comparing the runtime version.
    const result = meetsFloor(version, '22.22.2');
    // Then patch and minor versions affect eligibility.
    assert.equal(result, expected);
  });
}

for (const code of ['EAI_AGAIN', 'EUSAGE', 'EBADENGINE']) {
  test(`classifies only actual engine failures: ${code}`, async () => {
    // Given a real failed process with the npm diagnostic code.
    const { runChild, isEngineRejection } = await import(runner);
    let failure;
    try { runChild(process.execPath, ['-e', `console.error('${code}');process.exit(1)`], root); } catch (error) { failure = error; }
    // When classifying its failure.
    const result = isEngineRejection(failure);
    // Then unrelated install failures cannot count as engine rejection.
    assert.equal(result, code === 'EBADENGINE');
  });
}

test('accepts the major-only manifest floor at its exact minimum', async () => {
  // Given the provider manifest's major-only engine floor.
  const { meetsFloor } = await import(runner);
  // When comparing its first supported runtime.
  const result = meetsFloor('20.0.0', '20');
  // Then the declared minimum is accepted.
  assert.equal(result, true);
});

test('provider declares a runtime floor compatible with its locked server', async () => {
  // Given the committed provider manifest and lock.
  const provider = path.join(root, 'tooling/lsp/typescript');
  const manifest = JSON.parse(fs.readFileSync(path.join(provider, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(provider, 'package-lock.json'), 'utf8'));
  const { meetsFloor } = await import(runner);
  const minimum = [...manifest.engines.node.replace(/^>=/, '').split('.'), '0', '0'].slice(0, 3).join('.');
  // When checking the earliest declared runtime against the dependency's floor.
  const supported = meetsFloor(minimum, lock.packages['node_modules/typescript-language-server'].engines.node.replace(/^>=/, ''));
  // Then consumers are never promised a runtime the locked server rejects.
  assert.equal(supported, true);
  assert.equal(lock.packages[''].engines.node, manifest.engines.node);
});

test('LSP commands enforce the locked TypeScript provider runtime floor', () => {
  const os = require('node:os');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lazyzcode-lsp-floor-'));
  try {
    const target = fs.realpathSync(temporary);
    const bin = path.join(target, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(target, 'tsconfig.json'), '{}');
    const script = path.join(root, 'scripts/lazyzcode-tooling.sh');
    for (const [version, expected] of [['20.0.0', 'incompatible'], ['22.22.1', 'incompatible'], ['22.22.2', 'missing'], ['24.0.0', 'missing']]) {
      // The fake node evaluates the actual predicate using a selected version.
      const fake = `#!/bin/sh\nexec '${process.execPath}' -p "\$(printf '%s' \"$2\" | sed 's/process.versions.node/\"${version}\"/g')"\n`;
      fs.writeFileSync(path.join(bin, 'node'), fake, { mode: 0o755 });
      for (const command of expected === 'incompatible' ? ['lsp-status', 'lsp-install'] : ['lsp-status']) {
        const result = spawnSync('bash', [script, command, '--target', target, '--tooling-root', path.join(target, 'tooling')], {
          encoding: 'utf8', env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
        });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, new RegExp(`STATE: ${expected}`), `${version} ${command}: ${result.stdout}`);
      }
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('LSP fallback metadata agrees with locked provider manifests', () => {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(root, 'tooling', file), 'utf8'));
  const registry = read('capabilities.json').capabilities.semantic_navigation;
  const ts = read('lsp/typescript/package.json').dependencies;
  const python = read('lsp/python/package.json').dependencies;
  assert.deepEqual(registry[0].fallback_packages, [`typescript-language-server@${ts['typescript-language-server']}`, `typescript@${ts.typescript}`]);
  assert.deepEqual(registry[1].fallback_packages, [`basedpyright@${python.basedpyright}`]);
});
