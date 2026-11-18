import { createServer } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTenantAccessMonitor, needsTenantAccessCheck, tenantAccessRequest, TENANT_ACCESS_DENIED_EVENT } from '../src/utils/tenantAccess.js';
import { tenantAccessPlugin } from '../tenantAccessPlugin.js';

function harness(check) {
  const states = [];
  const events = new EventTarget();
  let interval;
  const timeouts = new Map();
  let timerId = 0;
  const timers = {
    setInterval(fn) { interval = fn; return 1; },
    clearInterval() { interval = undefined; },
    setTimeout(fn) { const id = ++timerId; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
  };
  const monitor = createTenantAccessMonitor({ check, onChange: state => states.push(state), events, timers });
  return { monitor, events, states, tick: () => interval?.(), timeout: () => [...timeouts.values()][0]?.() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

for (const host of ['school.localhost', 'school.chronous.uz', 'school.example']) {
  test(`requires admission on ${host}`, () => assert.equal(needsTenantAccessCheck({ hostname: host, search: '' }), true));
}
test('central platform and CEO do not require a tenant', () => {
  for (const host of ['localhost', '127.0.0.1', 'chronous.uz', 'admin.chronous.uz']) {
    assert.equal(needsTenantAccessCheck({ hostname: host, search: '' }), false);
  }
  assert.equal(needsTenantAccessCheck({ hostname: 'localhost', search: '?subdomain=school' }), true);
});
test('local admission uses hostname and never stored schema or credentials', () => {
  const request = tenantAccessRequest({ hostname: 'school.localhost', search: '' });
  assert.equal(request.headers['X-Tenant-Domain'], 'school.localhost');
  assert.equal(request.headers['X-Tenant-Schema'], undefined);
  assert.equal(request.url, 'http://127.0.0.1:8000/api/v1/public/tenants/access/');
});
test('denies initial blocked response before allowing app', async () => {
  const h = harness(async () => false);
  h.monitor.start(); await flush();
  assert.deepEqual(h.states, ['checking', 'unavailable']);
  h.monitor.stop();
});
test('heartbeat closes an already admitted page and permits reactivation', async () => {
  let allowed = true;
  const h = harness(async () => allowed);
  h.monitor.start(); await flush();
  assert.equal(h.states.at(-1), 'allowed');
  allowed = false; h.tick(); await flush();
  assert.equal(h.states.at(-1), 'unavailable');
  allowed = true; h.tick(); await flush();
  assert.equal(h.states.at(-1), 'allowed');
  h.monitor.stop();
});
test('API denial closes page immediately and stale success cannot reopen it', async () => {
  let complete;
  const h = harness(() => new Promise(resolve => { complete = resolve; }));
  h.monitor.start();
  h.events.dispatchEvent(new Event(TENANT_ACCESS_DENIED_EVENT));
  complete(true); await flush();
  assert.deepEqual(h.states, ['checking', 'unavailable']);
  h.monitor.stop();
});
test('network failure or offline cached page cannot admit app', async () => {
  const h = harness(async () => { throw new Error('offline'); });
  h.monitor.start(); await flush();
  assert.equal(h.states.at(-1), 'unavailable');
  h.events.dispatchEvent(new Event('offline'));
  assert.equal(h.states.at(-1), 'unavailable');
  h.monitor.stop();
});
test('timed-out check cannot reopen after abort', async () => {
  let complete;
  const h = harness(() => new Promise(resolve => { complete = resolve; }));
  h.monitor.start(); h.timeout(); complete(true); await flush();
  assert.equal(h.states.at(-1), 'unavailable');
  h.monitor.stop();
});
test('unmounted gate ignores in-flight replies and removes listeners', async () => {
  let complete;
  const h = harness(() => new Promise(resolve => { complete = resolve; }));
  h.monitor.start(); h.monitor.stop(); complete(true); await flush();
  h.events.dispatchEvent(new Event(TENANT_ACCESS_DENIED_EVENT));
  assert.deepEqual(h.states, ['checking']);
});

async function documentRequest({ host = 'school.localhost:5173', path = '/super_admin', accept = 'text/html', status = 204, fail = false } = {}) {
  let middleware, requested, next = false;
  const response = { status: null, body: null, writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
  tenantAccessPlugin({ fetchImpl: async (url, options) => {
    requested = { url, headers: options.headers };
    if (fail) throw new Error('offline');
    return { status };
  } }).configureServer({ middlewares: { use(fn) { middleware = fn; } } });
  await middleware({ method: 'GET', url: path, headers: { host, accept } }, response, () => { next = true; });
  return { response, requested, next };
}
test('blocked document returns HTTP 403 without SPA scripts', async () => {
  const result = await documentRequest({ status: 403 });
  assert.equal(result.response.status, 403);
  assert.equal(result.next, false);
  assert.match(result.response.body, /Malumot olishda xatolik/);
  assert.doesNotMatch(result.response.body, /<script|root|bloklangan/i);
  assert.equal(result.response.headers['Cache-Control'], 'no-store');
  assert.equal(result.requested.headers.Host, 'school.localhost:5173');
});
test('active document and central CEO page continue to Vite', async () => {
  assert.equal((await documentRequest()).next, true);
  const root = await documentRequest({ host: 'localhost:5173', path: '/ceo/login' });
  assert.equal(root.next, true);
  assert.equal(root.requested, undefined);
});
test('custom domains and nested paths cannot bypass document admission', async () => {
  const result = await documentRequest({ host: 'school.example', path: '/mentor/groups/1', status: 403 });
  assert.equal(result.response.status, 403);
  assert.equal(result.next, false);
});
test('backend outage fails closed while assets and API use their own handling', async () => {
  assert.equal((await documentRequest({ fail: true })).response.status, 503);
  assert.equal((await documentRequest({ path: '/api/groups/' })).next, true);
  assert.equal((await documentRequest({ path: '/src/main.jsx', accept: '*/*' })).next, true);
});

test('real HTTP admission forwards the original tenant Host', async () => {
  let observedHost;
  const backend = createServer((req, res) => {
    observedHost = req.headers.host;
    res.writeHead(observedHost === 'blocked.localhost:5173' ? 403 : 204);
    res.end();
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  try {
    let middleware, next = false;
    tenantAccessPlugin({ backendUrl: `http://127.0.0.1:${backend.address().port}` }).configureServer({ middlewares: { use(fn) { middleware = fn; } } });
    const response = { writeHead(status) { this.status = status; }, end() {} };
    await middleware({ method: 'GET', url: '/super_admin', headers: { host: 'blocked.localhost:5173', accept: 'text/html' } }, response, () => { next = true; });
    assert.equal(observedHost, 'blocked.localhost:5173');
    assert.equal(response.status, 403);
    assert.equal(next, false);
  } finally {
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
  }
});

test('omitting the browser HTML Accept header cannot bypass a tenant page check', async () => {
  const result = await documentRequest({ accept: '*/*', status: 403 });
  assert.equal(result.response.status, 403);
  assert.equal(result.next, false);
});
