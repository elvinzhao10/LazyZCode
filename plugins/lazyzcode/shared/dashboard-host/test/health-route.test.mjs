import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { listen } from '../service-http.mjs';

function http(origin, route, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body === undefined ? null : JSON.stringify(options.body);
    const call = request(origin + route, { method: body ? 'POST' : 'GET',
      headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}), ...options.headers } }, response => {
      let text = ''; response.on('data', data => { text += data; });
      response.on('end', () => resolve({ status: response.statusCode, text }));
    });
    call.on('error', reject); call.end(body);
  });
}

test('LazyZCode health is authenticated, works before project init and serves its real view assets', async () => {
  const credential = 'a'.repeat(64);
  const live = await listen({ port: 0, projectRoot: '/unused-health-probe', projectId: 'project:health', runId: null,
    assetRoot: fileURLToPath(new URL('../../dashboard/ui', import.meta.url)) },
  { credential, identity: { instance: 'health', port: 0 } });
  try {
    assert.equal((await http(live.origin, '/api/project/health')).status, 401);
    const session = await http(live.origin, '/api/session', { body: {}, headers: { 'x-dashboard-bootstrap': credential } });
    const token = JSON.parse(session.text).token;
    const response = await http(live.origin, '/api/project/health', { headers: { authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200);
    const health = JSON.parse(response.text);
    assert.equal(health.schema, 'lazybuddy/plugin-health@1');
    assert.equal(health.sections[0].items[0].observed, 'LazyZCode');
    assert.equal(health.sections.find(section => section.id === 'host').items[0].status, 'unavailable');
    assert.ok(!response.text.includes(credential) && !response.text.includes(token), 'health never emits credentials');
    for (const route of ['/health-view.mjs', '/health.css']) assert.equal((await http(live.origin, route)).status, 200);
  } finally { await live.close(); }
});
