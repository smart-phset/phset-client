import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { BrowserCamera, cameraConstraints, cameraError, cameraSource } from '../src/lib/browser-camera.ts';
import { FramePump } from '../src/lib/camera-analysis.ts';
import { liveHandlers } from '../src/lib/live-proxy.ts';

const fakeStream = () => { const track = { stopped: false, stop() { this.stopped = true; } }; return { track, getTracks: () => [track] }; };
test('integrated, USB, front and rear choices use device or facing constraints, never audio', () => {
  assert.deepEqual(cameraConstraints(''), { audio: false, video: true });
  assert.deepEqual(cameraConstraints('usb-id'), { audio: false, video: { deviceId: { exact: 'usb-id' } } });
  for (const mode of ['user', 'environment']) assert.deepEqual(cameraConstraints(mode), { audio: false, video: { facingMode: { ideal: mode } } });
  assert.equal(cameraSource('https://attacker/stream'), 'disabled');
  assert.equal(cameraSource(null), 'shared');
  assert.equal(cameraSource('disabled'), 'disabled');
});
test('two viewers have independent streams; stop and source switch release all owned tracks', async () => {
  const a = new BrowserCamera(), b = new BrowserCamera();
  const one = fakeStream(), two = fakeStream(), usb = fakeStream();
  await a.start({ getUserMedia: async () => one }, '');
  await b.start({ getUserMedia: async () => two }, 'environment');
  await a.start({ getUserMedia: async () => usb }, 'usb');
  assert.equal(one.track.stopped, true); assert.equal(two.track.stopped, false);
  a.stop(); assert.equal(usb.track.stopped, true); assert.equal(two.track.stopped, false);
  b.stop(); assert.equal(two.track.stopped, true);
});
test('permission granted after stop/unmount is discarded; late request cannot replace newer camera', async () => {
  const owner = new BrowserCamera(), old = fakeStream(), current = fakeStream();
  let grant;
  const pending = owner.start({ getUserMedia: () => new Promise(resolve => { grant = resolve; }) }, '');
  owner.stop();
  await owner.start({ getUserMedia: async () => current }, 'usb');
  grant(old);
  assert.equal(await pending, null); assert.equal(old.track.stopped, true); assert.equal(current.track.stopped, false);
  owner.stop();
});
test('permission, missing camera and busy errors are actionable', async () => {
  for (const [name, message] of [['NotAllowedError', 'permission denied'], ['NotFoundError', 'not found'], ['NotReadableError', 'already in use'], ['OverconstrainedError', 'not found']]) {
    const error = new Error(); error.name = name;
    assert.ok(cameraError(error).includes(message));
    await assert.rejects(new BrowserCamera().start({ getUserMedia: async () => { throw error; } }, ''), { name });
  }
});
test('manager requires explicit camera and AI start and renders preview controls', () => {
  const source = readFileSync(new URL('../src/components/CameraManager.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }, require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', js)(name => name === '@/lib/browser-camera' ? { BrowserCamera, cameraSource } : name === '@/lib/camera-analysis' ? { FramePump } : require(name), module, module.exports);
  const html = renderToStaticMarkup(React.createElement(module.exports.CameraManager));
  for (const text of ['Camera Disabled', 'Start Camera', 'Stop Camera', 'OFFLINE']) assert.ok(html.toLowerCase().includes(text.toLowerCase()), text);
  assert.ok(!html.includes('<img')); assert.ok(!html.includes('src='));
  assert.doesNotMatch(source, /MediaRecorder|localStorage/);
  assert.match(source, /autoPlay muted playsInline/);
  for (const text of ['Start AI Detection', 'Stop AI Detection', 'preview only']) assert.ok(html.includes(text));
  assert.match(source, /sessionStorage/);
});
test('shared proxy refuses another camera identity and never accepts viewer URLs', async () => {
  const session = async () => ({ guest: true });
  const req = new Request('http://web/api/ai/live/stream?camera=http://attacker');
  for (const stream of [false, true]) {
    const response = await liveHandlers('http://private-ai', session, async url => {
      assert.ok(url.startsWith('http://private-ai/'));
      return stream ? new Response('jpeg', { headers: { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'x-smartphset-camera-id': 'other' } })
        : Response.json({ camera: 'other', streaming: true, status: 'ok' });
    }, 'esp32-cam')(req, stream);
    assert.equal(response.status, 503);
  }
});

test('matching shared stream remains available for an authenticated guest', async () => {
  const response = await liveHandlers('http://private-ai', async () => ({ guest: true }), async () => new Response('frame', {
    headers: { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'x-smartphset-camera-id': 'esp32-cam' },
  }), 'esp32-cam')(new Request('http://web/api/ai/live/stream'), true);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'frame');
});

test('frame pump bounds concurrent uploads and discards capture after stop', async () => {
  const pump = new FramePump();
  let resolveCapture, sent = 0;
  pump.start(() => new Promise(resolve => { resolveCapture = resolve; }), async () => { sent++; });
  pump.stop(); resolveCapture(new Blob(['frame']));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(sent, 0);
  let release, inFlight = 0, maximum = 0;
  pump.start(async () => new Blob(['frame']), async (_, signal) => {
    inFlight++; maximum = Math.max(maximum, inFlight);
    await new Promise(resolve => { release = resolve; signal.addEventListener('abort', resolve); });
    inFlight--;
  }, 5);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(maximum, 1);
  pump.stop(); release();
});
