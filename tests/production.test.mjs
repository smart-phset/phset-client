import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { validateProductionEnv } from '../scripts/validate-runtime-env.mjs';
import { liveHandlers } from '../src/lib/live-proxy.ts';
import { requestedSharedCamera } from '../src/lib/shared-camera.ts';

const configuration = () => ({ AUTH_USER: 'team', AUTH_PASSWORD: 'A-strong-test-password', AUTH_SECRET: 'random-test-secret'.repeat(4),
  ALLOW_GUEST: 'false', SMARTPHSET_IOT_API_KEY: 'fixture-iot-key', SMARTPHSET_DEVICE_ID: 'grow-room-1',
  SMARTPHSET_API_BASE_URL: 'https://backend.test', SMARTPHSET_AI_LIVE_ENABLED: 'false', SMARTPHSET_AI_UPLOAD_ENABLED: 'false' });
function load(path, mocks = {}) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }, require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}

test('runtime validation rejects missing/placeholder credentials and unsafe enabled relays without exposing values', () => {
  assert.deepEqual(validateProductionEnv(configuration()), []);
  assert.ok(validateProductionEnv({}).length > 5);
  for (const change of [{ AUTH_SECRET: 'short' }, { AUTH_PASSWORD: 'REPLACE_WITH_PRIVATE_PASSWORD' }, { ALLOW_GUEST: '' },
    { SMARTPHSET_API_BASE_URL: 'http://public-backend.test' }, { SMARTPHSET_DEVICE_ID: '../bad' },
    { SMARTPHSET_AI_LIVE_ENABLED: 'true', SMARTPHSET_AI_LIVE_BASE_URL: 'http://127.0.0.1:8001' },
    { SMARTPHSET_AI_UPLOAD_ENABLED: 'true' }]) {
    const errors = validateProductionEnv({ ...configuration(), ...change });
    assert.ok(errors.length, JSON.stringify(Object.keys(change)));
    assert.ok(!errors.join('\n').includes('REPLACE_WITH_PRIVATE_PASSWORD'));
  }
  assert.deepEqual(validateProductionEnv({ ...configuration(), SMARTPHSET_AI_LIVE_ENABLED: 'true',
    SMARTPHSET_AI_LIVE_BASE_URL: 'https://private-relay.test', SMARTPHSET_AI_RELAY_TOKEN: 'fixture-token', SMARTPHSET_AI_CAMERA_ID: 'esp32-cam' }), []);
});

test('public liveness reports only process status and remains separate from authenticated diagnostic health', async () => {
  const { GET } = load('../src/app/api/healthz/route.ts');
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('disabled shared camera authenticates and never contacts the relay', async () => {
  const previous = process.env.SMARTPHSET_AI_LIVE_ENABLED;
  process.env.SMARTPHSET_AI_LIVE_ENABLED = 'false';
  try {
    for (const authenticated of [false, true]) {
      const { liveApi } = load('../src/lib/live-server.ts', { 'server-only': {}, './shared-camera.ts': { requestedSharedCamera }, './session': { currentUser: async () => authenticated ? { guest: false } : null },
        './live-proxy': { liveHandlers: () => assert.fail('disabled live service made a handler') } });
      const response = await liveApi()(new Request('http://site/api/ai/live/stream'), true);
      assert.equal(response.status, authenticated ? 503 : 401);
      if (authenticated) assert.equal((await response.json()).status, 'disabled');
    }
  } finally {
    if (previous === undefined) delete process.env.SMARTPHSET_AI_LIVE_ENABLED;
    else process.env.SMARTPHSET_AI_LIVE_ENABLED = previous;
  }
});

test('disabled photo inference cannot consume or upload a body or return demo detections', async () => {
  const previous = process.env.SMARTPHSET_AI_UPLOAD_ENABLED;
  process.env.SMARTPHSET_AI_UPLOAD_ENABLED = 'false';
  try {
    const { POST } = load('../src/app/api/images/route.ts', { '@/lib/auth': { sameOrigin: () => true }, '@/lib/backend': { BACKEND_URL: 'https://private-ai.test', demo: () => assert.fail('demo fallback') } });
    const response = await POST({ arrayBuffer: () => assert.fail('disabled endpoint consumed media') });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'analysis_disabled');
  } finally {
    if (previous === undefined) delete process.env.SMARTPHSET_AI_UPLOAD_ENABLED;
    else process.env.SMARTPHSET_AI_UPLOAD_ENABLED = previous;
  }
});

test('relay credential travels server-to-server only; redirects cannot receive it', async () => {
  const token = 'fixture-relay-credential';
  const response = await liveHandlers('https://relay.test', async () => ({ guest: false }), async (url, init) => {
    assert.equal(url, 'https://relay.test/health');
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    assert.equal(init.redirect, 'error');
    return Response.json({ status: 'ok', streaming: true, camera: 'esp32-cam', private: token });
  }, 'esp32-cam', token)(new Request('https://site.test/api/ai/live/health'), false);
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes(token));
});

test('production sign-in keeps Secure/HttpOnly cookies, safe redirects and disabled-guest policy', async () => {
  const auth = await import('../src/lib/auth.ts');
  const previous = Object.fromEntries(Object.keys(configuration()).map(name => [name, process.env[name]]));
  Object.assign(process.env, configuration());
  try {
    const { POST } = load('../src/app/api/auth/signin/route.ts', { '@/lib/auth': auth });
    const request = form => new Request('https://staging.test/api/auth/signin', {
      method: 'POST', body: new URLSearchParams(form), headers: { 'X-Forwarded-Proto': 'https' },
    });
    const valid = await POST(request({ username: 'team', password: configuration().AUTH_PASSWORD, next: 'https://attacker.test' }));
    assert.equal(valid.status, 303);
    assert.equal(valid.headers.get('location'), '/');
    const cookie = valid.headers.get('set-cookie');
    for (const flag of ['HttpOnly', 'SameSite=Lax', 'Secure']) assert.ok(cookie.includes(flag));
    assert.equal(await auth.verify(cookie.split(';')[0].slice('sp_session='.length)), 'team');
    for (const form of [{ username: 'team', password: 'incorrect' }, { mode: 'guest' }]) {
      const denied = await POST(request(form));
      assert.equal(denied.status, 303);
      assert.equal(denied.headers.get('set-cookie'), null);
      assert.match(denied.headers.get('location'), /error=/);
    }
  } finally {
    for (const name of Object.keys(configuration())) {
      if (name in previous && previous[name] !== undefined) process.env[name] = previous[name];
      else delete process.env[name];
    }
  }
});

test('only the exact liveness API path is exempt from the proxy authentication matcher', () => {
  const source = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8');
  const matcher = source.match(/matcher: \["([^"]+)"\]/)[1];
  const pattern = new RegExp(`^${matcher}$`);
  assert.equal(pattern.test('/api/healthz'), false);
  for (const path of ['/api/healthz-extra', '/api/health', '/api/monitoring/state', '/api/images', '/api/ai/live/stream', '/scan']) {
    assert.equal(pattern.test(path), true, path);
  }
});

test('relay secrets are never sent over plaintext HTTP or without a viewer session', async () => {
  for (const [base, session, expected] of [
    ['http://relay.test', async () => ({ guest: false }), 503],
    ['https://relay.test', async () => null, 401],
  ]) {
    const response = await liveHandlers(base, session, async () => assert.fail('credential must not be transmitted'), 'esp32-cam', 'fixture-token')(
      new Request('https://site.test/api/ai/live/stream'), true);
    assert.equal(response.status, expected);
  }
});

test('private smoke env loader preserves literal credential punctuation without shell evaluation', async () => {
  const { parseRuntimeEnv } = await import('../scripts/runtime-env-file.mjs');
  assert.deepEqual(parseRuntimeEnv('# comment\r\nAUTH_PASSWORD=literal$and#hash\r\nAPI_KEY=a=b\r\n\r\n'), {
    AUTH_PASSWORD: 'literal$and#hash', API_KEY: 'a=b',
  });
  for (const value of ['AUTH_SECRET=one\nAUTH_SECRET=two', 'not-a-key=value', 'invalid-line']) {
    assert.throws(() => parseRuntimeEnv(value), /line \d+/);
  }
});
