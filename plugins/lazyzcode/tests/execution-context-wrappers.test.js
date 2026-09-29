'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { commandErrors } = require('../contracts/execution-context-security');

test('execution contract rejects wrappers that can hide a shell command', () => {
  for (const argv of [
    ['env', 'sh', '-c', 'touch product.ts'],
    ['nice', 'sh', '-c', 'touch product.ts'],
    ['nohup', 'sh', '-c', 'touch product.ts'],
    ['xargs', 'sh', '-c', 'touch product.ts'],
    ['/usr/bin/env', 'sh', '-c', 'touch product.ts'],
  ]) {
    assert.ok(commandErrors([{ argv }]).length > 0, argv.join(' '));
  }
  assert.deepEqual(commandErrors([{ argv: ['git', 'status', '--short'] }]), []);
});
