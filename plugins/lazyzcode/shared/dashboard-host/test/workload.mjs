#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const [action, artifact, expected] = process.argv.slice(2);
if (action === 'write') {
  await writeFile(artifact, `${expected}\n`);
  process.stdout.write(`${JSON.stringify({ artifact, value: expected })}\n`);
} else if (action === 'verify') {
  const actual = await readFile(artifact, 'utf8');
  if (actual !== `${expected}\n`) process.exitCode = 9;
  else process.stdout.write('{"verdict":"approved"}\n');
} else process.exitCode = 64;
