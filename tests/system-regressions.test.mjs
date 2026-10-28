import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as auth from '../src/lib/auth.ts';
import * as analysis from '../src/lib/camera-analysis.ts';
import * as camera from '../src/lib/browser-camera.ts';
import { liveHandlers } from '../src/lib/live-proxy.ts';

function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }, require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

function cameraEnvironment() {
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  globalThis.BroadcastChannel = class { postMessage() {} close() {} };
  const sessions = new Map(); let next = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (url === '/api/cameras') return Response.json([{ id: 'esp32-cam', label: 'Grow room', availability: 'idle' }, { id: 'webcam-0', label: 'Worker camera', availability: 'idle' }]);
    if (url === '/api/cameras/sessions') {
      const id = `session-${++next}`;
      const value = { session_id: id, source_id: JSON.parse(options.body).source_id, status: 'LIVE', analyzing: false, detection: null };
      sessions.set(id, value); return Response.json(value);
    }
    const id = url.split('/')[4];
    if (options.method === 'DELETE') { sessions.delete(id); return Response.json({}); }
    return Response.json(sessions.get(id) || {});
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

// Execute actual handlers/effects with isolated hooks and media. This is not a browser test.
function manager(saved = null) {
  const slots = [], effects = [];
  let cursor = 0, pending = [], value = saved, tree;
  const hooks = { ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!effects[i] || deps.some((v, j) => v !== effects[i].deps[j])) pending.push(() => {
        effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: callback() };
      });
    },
  };
  const { CameraManager } = load('../src/components/CameraManager.tsx', {
    react: hooks, '@/lib/browser-camera': camera, '@/lib/camera-analysis': analysis,
  });
  return {
    render() {
      globalThis.sessionStorage = { getItem: () => value, setItem: (_k, v) => { value = v; } };
      cursor = 0; tree = CameraManager();
      const video = find(tree, n => n.type === 'video');
      if (video) video.props.ref.current = { srcObject: null, play: async () => {} };
      const run = pending; pending = []; run.forEach(f => f());
      return tree;
    },
    preference() { return value; },
    button(label) { return find(tree, n => n.type === 'button' && n.props.children === label); },
    select(value) { find(tree, n => n.type === 'select').props.onChange({ target: { value } }); },
    unmount() { effects.forEach(e => e?.cleanup?.()); },
  };
}

test('actual Camera Manager starts/stops shared without browser permission and restores independent preferences', async () => {
  const descriptors = ['window', 'navigator', 'sessionStorage', 'fetch', 'document', 'BroadcastChannel'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  cameraEnvironment();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: () => assert.fail('shared source requested browser camera'), enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {},
  } } });
  try {
    const one = manager(), two = manager('disabled');
    one.render(); two.render(); await flush(); one.render(); two.render();
    assert.equal(one.button('Start Camera').props.disabled, false);
    one.button('Start Camera').props.onClick(); await flush(); one.render();
    assert.equal(one.button('Stop Camera').props.disabled, false);
    one.button('Stop Camera').props.onClick(); one.render();
    assert.equal(one.button('Start Camera').props.disabled, false);
    two.render(); assert.equal(two.button('Start Camera').props.disabled, true);
    two.select('shared'); two.render(); assert.equal(two.button('Start Camera').props.disabled, false);
    one.select('local'); one.render(); two.render();
    assert.equal(two.button('Start Camera').props.disabled, false);
    one.unmount(); two.unmount();
  } finally { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
});

test('healthy producer cannot display LIVE before a browser image loads; stalled stream is explained', () => {
  const { LiveDetectionView } = load('../src/components/LiveDetectionPanel.tsx', {
    '@/features/ai-alerts/aiDetectionApi': {}, '@/features/ai-alerts/AISeverityBadge': { AISeverityBadge: () => null }, '@/features/ai-alerts/aiAlertTransitions': {},
  });
  const props = { health: { status: 'ok', streaming: true }, detection: null, metadataError: false, streamError: false, streamVersion: 0, onStreamError() {}, onRetry() {} };
  const render = value => renderToStaticMarkup(React.createElement(LiveDetectionView, { ...props, ...value }));
  assert.ok(!render({}).includes('>LIVE<'));
  assert.ok(render({ streamLoaded: true }).includes('>LIVE<'));
  assert.ok(!render({ streamLoaded: true, streamError: true }).includes('>LIVE<'));
  assert.ok(render({ health: { status: 'stalled', streaming: false } }).includes('frames stopped'));
});

test('proxy rejects contradictory health and forwards authenticated source header on streams', async () => {
  const session = async () => ({}), req = new Request('http://web/stream');
  const health = await liveHandlers('http://ai', session, async () => Response.json({ status: 'stalled', streaming: true, camera: 'esp32-cam' }), 'esp32-cam')(req, false);
  assert.equal((await health.json()).streaming, false);
  const stream = await liveHandlers('http://ai', session, async () => new Response('frame', { headers: { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'x-smartphset-camera-id': 'esp32-cam' } }), 'esp32-cam')(req, true);
  assert.equal(stream.headers.get('x-smartphset-camera-id'), 'esp32-cam');
  await stream.body.cancel();
});

test('signed sessions are unique, reject tampering, expire server-side, and reject legacy tokens', async () => {
  const previous = process.env.AUTH_PASSWORD;
  process.env.AUTH_PASSWORD = 'isolated-test-password';
  const now = Date.now;
  try {
    const token = await auth.sign('team');
    assert.equal(await auth.verify(token), 'team');
    assert.notEqual(await auth.sign('team'), token);
    assert.equal(await auth.verify(token + '0'), null);
    assert.equal(await auth.verify('team.' + 'a'.repeat(64)), null);
    const future = now() + (auth.MAX_AGE + 1) * 1000;
    Date.now = () => future;
    assert.equal(await auth.verify(token), null);
  } finally { Date.now = now; if (previous === undefined) delete process.env.AUTH_PASSWORD; else process.env.AUTH_PASSWORD = previous; }
});

test('cross-origin login/logout are rejected; logout is POST and clears cookie', async () => {
  const signin = load('../src/app/api/auth/signin/route.ts', { '@/lib/auth': auth });
  const signout = load('../src/app/api/auth/signout/route.ts', { '@/lib/auth': auth });
  assert.equal(signout.GET, undefined);
  for (const route of [signin, signout]) {
    assert.equal((await route.POST(new Request('https://web/auth', { method: 'POST', headers: { Origin: 'https://attacker' } }))).status, 403);
  }
  const response = await signout.POST(new Request('https://web/auth', { method: 'POST', headers: { Origin: 'https://web' } }));
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('upload rejects oversized/non-JPEG media and sanitizes upstream errors', async () => {
  const backend = { BACKEND_URL: 'http://ai', BACKEND_MODE: 'bridge', backendHeaders: x => x, unreachable: () => Response.json({ error: 'unavailable' }, { status: 503 }) };
  const { POST } = load('../src/app/api/images/route.ts', { '@/lib/auth': auth, '@/lib/backend': backend });
  const previous = process.env.SMARTPHSET_AI_UPLOAD_ENABLED;
  delete process.env.SMARTPHSET_AI_UPLOAD_ENABLED;
  try {
    for (const [type, bytes, expected] of [['text/plain', 1, 415], ['image/jpeg', 2 * 1024 * 1024 + 1, 413], ['image/jpeg', 0, 400]]) {
      const response = await POST(new Request('http://web/api/images', { method: 'POST', headers: { 'Content-Type': type }, body: new Uint8Array(bytes) }));
      assert.equal(response.status, expected);
    }
  } finally { if (previous !== undefined) process.env.SMARTPHSET_AI_UPLOAD_ENABLED = previous; }
});

test('local permission denial is retryable; navigation releases a subsequently granted local stream', async () => {
  const descriptors = ['window', 'navigator', 'sessionStorage', 'fetch', 'document', 'BroadcastChannel'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const track = { stopped: false, stop() { this.stopped = true; }, addEventListener() {}, label: 'USB camera' };
  let denied = true;
  cameraEnvironment();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: async () => { if (denied) { const error = new Error(); error.name = 'NotAllowedError'; throw error; } return { getTracks: () => [track], getVideoTracks: () => [track] }; },
    enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {},
  } } });
  try {
    const instance = manager('local'); instance.render(); instance.render();
    instance.button('Start Camera').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    instance.render();
    assert.ok(instance.button('Retry'));
    assert.equal(instance.button('Start Camera').props.disabled, false);
    denied = false;
    instance.button('Retry').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    instance.render(); assert.equal(instance.button('Stop Camera').props.disabled, false);
    instance.unmount(); assert.equal(track.stopped, true);
  } finally { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
});

test('production unconfigured upload fails explicitly rather than synthesizing a detection', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const { POST } = load('../src/app/api/images/route.ts', { '@/lib/auth': auth, '@/lib/backend': { BACKEND_URL: '', demo: () => assert.fail('production demo') } });
    const response = await POST(new Request('http://web/images', { method: 'POST' }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'analysis_unconfigured');
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test('backend transport exception details are not returned to the browser', () => {
  const { unreachable } = load('../src/lib/backend.ts');
  return unreachable(new Error('private-token@internal-host')).text().then(body => {
    assert.ok(!body.includes('private-token')); assert.ok(!body.includes('internal-host'));
  });
});

test('Origin checks support the trusted reverse proxy public Host while rejecting forged origins', () => {
  const request = origin => new Request('http://localhost:3000/api/auth/signin', {
    method: 'POST', headers: { Host: 'phset.ratanak.me', 'X-Forwarded-Proto': 'https', Origin: origin },
  });
  assert.equal(auth.sameOrigin(request('https://phset.ratanak.me')), true);
  assert.equal(auth.sameOrigin(request('http://localhost:3000')), false);
  assert.equal(auth.sameOrigin(request('https://attacker.test')), false);
});

test('proxied command Origin permits public host and still blocks foreign origins without dispatching hardware commands', async () => {
  const { monitoringHandlers } = await import('../src/lib/monitoring-proxy.ts');
  const api = monitoringHandlers({}, async () => ({ guest: false }), () => assert.fail('negative test dispatched a command'));
  for (const [origin, expected] of [['https://phset.ratanak.me', 400], ['https://attacker.test', 403]]) {
    const response = await api.command(new Request('http://localhost:3000/api/monitoring/actuators/__invalid__', {
      method: 'POST', headers: { Host: 'phset.ratanak.me', 'X-Forwarded-Proto': 'https', Origin: origin, 'Content-Type': 'application/json' }, body: '{"on":false}',
    }), '__invalid__');
    assert.equal(response.status, expected);
  }
});

test('busy webcam can retry or switch to Python AI without a second browser capture; tabs stay independent', async () => {
  const descriptors = ['window', 'navigator', 'sessionStorage', 'fetch', 'document', 'BroadcastChannel'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  let busy = true, captures = 0;
  const track = { stopped: false, stop() { this.stopped = true; }, addEventListener() {}, label: 'Laptop camera' };
  cameraEnvironment();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: async () => {
      captures++;
      if (busy) throw Object.assign(new Error(), { name: 'NotReadableError' });
      return { getTracks: () => [track], getVideoTracks: () => [track] };
    }, enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {},
  } } });
  try {
    const one = manager('local'), peer = manager('shared');
    one.render(); one.render(); peer.render(); peer.render();
    one.button('Start Camera').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    const failed = one.render();
    assert.ok(find(failed, n => n.props?.role === 'alert').props.children.includes('Python YOLO'));
    assert.equal(one.button('Start Camera').props.disabled, false);
    assert.ok(one.button('Retry'));
    busy = false;
    one.button('Retry').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    one.render(); assert.equal(one.button('Stop Camera').props.disabled, false);
    one.select('shared:webcam-0'); one.render();
    assert.equal(track.stopped, true);
    assert.equal(one.preference(), 'shared:webcam-0');
    assert.equal(peer.preference(), 'shared');
    const restored = manager(one.preference()); restored.render(); restored.render();
    assert.equal(restored.button('Start Camera').props.disabled, false);
    one.button('Start Camera').props.onClick();
    await flush();
    const ai = one.render();
    assert.ok(find(ai, n => n.type === 'img' && n.props.src.includes('/sessions/')));
    assert.equal(captures, 2);
    peer.render(); peer.button('Start Camera').props.onClick();
    await flush();
    assert.ok(find(peer.render(), n => n.type === 'img' && n.props.src.includes('/sessions/')));
    one.button('Stop Camera').props.onClick(); one.render();
    assert.equal(one.button('Start Camera').props.disabled, false);
    peer.render(); assert.equal(peer.button('Stop Camera').props.disabled, false);
    assert.equal(captures, 2);
    one.unmount(); peer.unmount(); restored.unmount();
  } finally { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
});
