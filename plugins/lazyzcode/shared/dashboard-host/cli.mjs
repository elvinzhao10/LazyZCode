#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { capabilities } from './capabilities.mjs';
import { main as service } from './service.mjs';
import { ServiceError } from './service-files.mjs';

export async function main(argv) {
  const [action, ...args] = argv;
  if (!['start', 'status', 'open', 'stop'].includes(action)) throw new ServiceError('INVALID_ARGV');
  const result = await service([action === 'open' ? 'start' : action, ...args]);
  return { ...result, entry: 'browser', capabilities };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).then(value => process.stdout.write(`${JSON.stringify(value)}\n`))
    .catch(error => {
      process.stderr.write(`${JSON.stringify({ status: 'rejected', code: error instanceof ServiceError ? error.code : 'SERVICE_FAILURE' })}\n`);
      process.exitCode = 65;
    });
}
