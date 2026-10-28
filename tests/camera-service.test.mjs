import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { sameOrigin } from '../src/lib/request-origin.ts';
function load(token) {
  const source = readFileSync(new URL('../src/lib/camera-service.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }, require = createRequire(import.meta.url);
  const mocks = { 'server-only': {}, 'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) }, './auth': { COOKIE: 'sp_session', verify: async value => value || null, sameOrigin } };
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports.cameraService;
}
async function setup(run) {
  const before = { ...process.env }, original = globalThis.fetch;
  process.env.SMARTPHSET_AI_SERVICE_KEY = 'server-only-secret';
  process.env.SMARTPHSET_AI_SERVICE_URL = 'http://worker';
  process.env.SMARTPHSET_CAMERA_API_KEY = 'registry-secret';
  process.env.BACKEND_URL = 'http://spring';
  process.env.SMARTPHSET_API_BASE_URL = 'http://spring';
  try { await run(); } finally {
    globalThis.fetch = original;
    for (const key of ['SMARTPHSET_AI_SERVICE_KEY', 'SMARTPHSET_AI_SERVICE_URL', 'SMARTPHSET_CAMERA_API_KEY', 'BACKEND_URL', 'SMARTPHSET_API_BASE_URL']) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
  }
}
const request = (path, body, extra = {}) => new Request(`https://web/api/cameras/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'https://web', ...extra }, body });
test('camera proxy authenticates and checks mutation origins before upstream access', () => setup(async () => {
  globalThis.fetch = () => assert.fail('unauthorized upstream access');
  assert.equal((await load(null)(request('sessions'), ['sessions'])).status, 401);
  assert.equal((await load('login')(request('sessions', '{}', { Origin: 'https://foreign' }), ['sessions'])).status, 403);
}));
test('browser inference needs no registry and separate same-account logins get distinct owners', () => setup(async () => {
  const owners = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://worker/sessions');
    assert.equal(options.headers.Authorization, 'Bearer server-only-secret');
    owners.push(options.headers['X-Camera-Owner']);
    return Response.json({ session_id: 'opaque', source_id: 'browser' }, { status: 201 });
  };
  for (const token of ['same-account-login-1', 'same-account-login-2']) {
    const response = await load(token)(request('sessions', '{"source_id":"browser"}'), ['sessions']);
    assert.equal(response.status, 201);
    assert.ok(!(await response.text()).includes('server-only-secret'));
  }
  assert.notEqual(owners[0], owners[1]);
}));
test('registry is authoritative; viewer URLs never reach capture', () => setup(async () => {
  const urls = [];
  globalThis.fetch = async url => { urls.push(url); return Response.json({}, { status: 404 }); };
  assert.equal((await load('login')(request('sessions', '{"source_id":"unknown"}'), ['sessions'])).status, 404);
  assert.deepEqual(urls, ['http://spring/api/cameras/unknown/availability']);
  urls.length = 0;
  await load('login')(request('sessions', '{"source_id":"http://internal"}'), ['sessions']);
  assert.equal(urls.length, 0);
}));
test('oversized frames and unknown actions never contact AI', () => setup(async () => {
  globalThis.fetch = () => assert.fail('oversized upstream access');
  assert.equal((await load('login')(request('sessions/id/frames', new Uint8Array(524289)), ['sessions', 'id', 'frames'])).status, 413);
  assert.equal((await load('login')(request('sessions/id/redirect'), ['sessions', 'id', 'redirect'])).status, 404);
}));
test('registry strips private fields and includes runtime availability', () => setup(async () => {
  globalThis.fetch = async url => url === 'http://spring/api/cameras'
    ? Response.json([{ id: 'esp32-cam', label: 'Grow room', url: 'http://private' }])
    : Response.json({ 'esp32-cam': { status: 'camera_unavailable', streaming: false } });
  assert.deepEqual(await (await load('login')(request(''), [])).json(), [{ id: 'esp32-cam', label: 'Grow room', availability: 'camera_unavailable' }]);
}));
test('transport errors expose no internal addresses or secrets', () => setup(async () => {
  globalThis.fetch = async () => { throw new Error('http://private/server-only-secret'); };
  const response = await load('login')(request('sessions/id'), ['sessions', 'id']);
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '{"error":"camera_service_unavailable"}');
}));
