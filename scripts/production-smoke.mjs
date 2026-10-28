// Read-only integrations plus deliberately INVALID actuator routes. Never actuates hardware.
// Run against a built local server or an explicitly approved staging origin.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRuntimeEnv } from './runtime-env-file.mjs';

if (process.env.SMOKE_ENV_FILE) {
  const values = parseRuntimeEnv(await readFile(process.env.SMOKE_ENV_FILE, 'utf8'));
  for (const [name, value] of Object.entries(values)) {
    if (/^(AUTH_|SMARTPHSET_|ALLOW_GUEST$|BACKEND_|API_KEY$)/.test(name) && process.env[name] === undefined) process.env[name] = value;
  }
}

const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3100');
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
if (!loopback && process.env.SMOKE_ALLOW_REMOTE_READS !== 'true') throw new Error('Remote checks require SMOKE_ALLOW_REMOTE_READS=true and an approved staging origin.');
if (!loopback && base.protocol !== 'https:') throw new Error('Remote staging requires HTTPS.');
if (base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('SMOKE_BASE_URL must be a plain origin.');
const username = process.env.AUTH_USER || 'team';
const password = process.env.AUTH_PASSWORD;
if (!password) throw new Error('Load AUTH_PASSWORD from the private raw env file using SMOKE_ENV_FILE; never pass a password in command arguments.');

async function request(path, init = {}, cookie = '') {
  return fetch(new URL(path, base), { ...init, headers: { ...init.headers, ...(cookie ? { Cookie: cookie } : {}) },
    redirect: 'manual', signal: AbortSignal.timeout(8000) });
}
function status(response, expected, label) {
  assert.ok([expected].flat().includes(response.status), `${label}: expected ${expected}, received ${response.status}`);
}
const report = label => console.log(`PASS ${label}`);
const liveness = await request('/api/healthz');
status(liveness, 200, 'liveness');
assert.deepEqual(await liveness.json(), { status: 'ok' });
report('public liveness');
for (const path of ['/api/monitoring/state', '/api/ai/live/stream', '/api/ai/live/detection']) {
  const response = await request(path);
  status(response, 401, 'unauthenticated API');
  await response.body?.cancel();
}
const gate = await request('/scan');
status(gate, [303, 307], 'page gate');
assert.equal(new URL(gate.headers.get('location'), base).pathname, '/signin');
report('authentication gate');
const wrong = await request('/api/auth/signin', { method: 'POST', body: new URLSearchParams({ username: '__smoke_invalid__', password: '__invalid__' }) });
status(wrong, 303, 'invalid sign-in');
assert.ok(wrong.headers.get('location').includes('error='));
assert.equal(wrong.headers.get('set-cookie'), null);

async function signIn(form) {
  const response = await request('/api/auth/signin', { method: 'POST', body: new URLSearchParams(form) });
  status(response, 303, 'sign-in');
  const value = response.headers.get('set-cookie');
  assert.ok(value?.startsWith('sp_session='), 'sign-in did not issue a session');
  for (const flag of ['HttpOnly', 'SameSite=Lax']) assert.ok(value.includes(flag));
  if (base.protocol === 'https:') assert.match(value, /; Secure;/);
  return { response, cookie: value.split(';')[0] };
}
const one = await signIn({ username, password, next: 'https://untrusted.invalid' });
assert.equal(one.response.headers.get('location'), '/');
const two = await signIn({ username, password, next: '/scan' });
for (const viewer of [one, two]) {
  for (const path of ['/', '/scan', '/climate', '/alerts', '/history', '/status', '/settings', '/setup']) {
    const response = await request(path, {}, viewer.cookie);
    status(response, 200, 'authenticated page');
    const html = await response.text();
    if (path === '/scan') assert.ok(html.includes('Camera Manager'));
    for (const key of ['AUTH_PASSWORD', 'AUTH_SECRET', 'SMARTPHSET_IOT_API_KEY', 'SMARTPHSET_AI_RELAY_TOKEN']) {
      if (process.env[key]) assert.ok(!html.includes(process.env[key]), 'server credential appeared in HTML');
    }
  }
}
report('two same-account HTTP sessions and camera page (browser state requires acceptance checklist)');

// The actuator identifier is invalid in EVERY negative test: even a broken Origin
// or role guard cannot target fan, light or pump. No valid command is transmitted.
async function rejectedCommand(cookie, origin, expected) {
  const response = await request('/api/monitoring/actuators/__smoke_invalid__', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{"on":false}' }, cookie);
  status(response, expected, 'invalid actuator command');
}
await rejectedCommand('', base.origin, 401);
await rejectedCommand(one.cookie, 'https://untrusted.invalid', 403);
await rejectedCommand(one.cookie, base.origin, 400);
const guest = await request('/api/auth/signin', { method: 'POST', body: new URLSearchParams({ mode: 'guest', next: '/scan' }) });
status(guest, 303, 'guest policy');
if (process.env.ALLOW_GUEST === 'true') {
  const cookie = guest.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'allowed guest did not receive a cookie');
  await rejectedCommand(cookie, base.origin, 403);
} else {
  assert.equal(guest.headers.get('set-cookie'), null);
  assert.ok(guest.headers.get('location').includes('error=noguest'));
}
report('Origin, guest and invalid-command guards without actuation');

const state = await request('/api/monitoring/state', {}, one.cookie);
if (process.env.SMOKE_REQUIRE_IOT !== 'false') status(state, 200, 'IoT monitoring read');
else status(state, [200, 502, 503], 'IoT monitoring read');
if (state.ok) {
  const body = await state.json();
  assert.equal(body.deviceId, process.env.SMARTPHSET_DEVICE_ID || 'grow-room-1');
  assert.equal(body.canControl, true);
  assert.ok(body.state);
  report('authenticated IoT state read (physical state not inferred)');
} else { await state.body?.cancel(); console.log('PENDING IoT integration unavailable; limited smoke mode allows this.'); }

const health = await request('/api/ai/live/health', {}, one.cookie);
if (process.env.SMARTPHSET_AI_LIVE_ENABLED === 'false') {
  status(health, 503, 'disabled shared camera');
  assert.equal((await health.json()).status, 'disabled');
  const stream = await request('/api/ai/live/stream', {}, one.cookie);
  status(stream, 503, 'disabled shared stream');
  await stream.body?.cancel();
  report('shared video fails closed while relay disabled');
} else {
  status(health, 200, 'AI relay health');
  const body = await health.json();
  assert.equal(body.camera, process.env.SMARTPHSET_AI_CAMERA_ID);
  assert.equal(body.streaming, true);
  const stream = await request('/api/ai/live/stream', {}, one.cookie);
  status(stream, 200, 'AI relay video');
  assert.match(stream.headers.get('content-type') || '', /^multipart\/x-mixed-replace/);
  const reader = stream.body.getReader();
  try { assert.ok((await reader.read()).value?.length, 'relay returned no bytes'); }
  finally { await reader.cancel(); }
  report('relay health/source identity and video bytes; stream cancelled');
}
if (process.env.SMARTPHSET_AI_UPLOAD_ENABLED === 'false') {
  const photo = await request('/api/images', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array([0]) }, one.cookie);
  status(photo, 503, 'disabled image analysis');
  assert.equal((await photo.json()).error, 'analysis_disabled');
  report('photo analysis disabled with no demo fallback');
}
const metadata = await request('/api/ai/live/detection', {}, one.cookie);
if (process.env.SMOKE_REQUIRE_AI_READS === 'true') status(metadata, 200, 'AI metadata');
else status(metadata, [200, 404, 502, 503], 'AI metadata');
if (metadata.ok) {
  const body = await metadata.json();
  assert.equal(body.cameraId, process.env.SMARTPHSET_AI_CAMERA_ID);
  assert.equal(body.detection.camera_id, body.cameraId);
  report('AI metadata source association');
} else { await metadata.body?.cancel(); console.log('PENDING authenticated AI reads unavailable; deployment dependency remains.'); }
const logout = await request('/api/auth/signout', { method: 'POST' }, one.cookie);
status(logout, 303, 'logout');
assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/);
report('logout clears browser cookie (server-side revocation is not implemented)');
console.log('HTTP smoke checks complete. Browser permission/cleanup, mobile, physical hardware and concurrent inference require the acceptance checklist.');
