'use strict';

const { verifyStagedPackage } = require('./lifecycle/bootstrap');

const result = verifyStagedPackage(process.cwd(), 'LazyZCode');
process.stdout.write(`${JSON.stringify({ product: 'LazyZCode', status: 'passed', version: result.version })}\n`);
