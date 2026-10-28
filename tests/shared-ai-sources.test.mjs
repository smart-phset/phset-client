import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { requestedSharedCamera } from '../src/lib/shared-camera.ts';
import { cameraSource } from '../src/lib/browser-camera.ts';
import { liveHandlers } from '../src/lib/live-proxy.ts';
import { monitoringHandlers } from '../src/lib/monitoring-proxy.ts';

function load(path, mocks = {}) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} }, require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const request = (camera, route = 'health') => new Request(`http://web/api/ai/live/${route}${camera === undefined ? '' : `?camera=${encodeURIComponent(camera)}`}`);
const session = async () => ({ guest: false });
const result = camera => ({ id: 'saved', camera_id: camera, captured_at: '2026-10-28T00:00:00Z', created_at: '2026-10-28T00:00:00Z',
  verdict: 'no_contamination_seen', severity: 'GREEN', message: 'Matched saved detection', n_healthy: 1, n_contaminated: 0, max_conf: .9, max_contaminated_conf: 0 });

test('only known Python source identities are selectable; legacy per-tab preferences remain valid', () => {
  assert.equal(cameraSource('laptop-ai'), 'laptop-ai');
  assert.equal(cameraSource('shared'), 'shared');
  assert.equal(cameraSource('local'), 'local');
  for (const id of ['webcam-0', 'esp32-cam']) assert.equal(requestedSharedCamera(request(id)), id);
  assert.equal(requestedSharedCamera(request()), undefined);
  for (const id of ['http://attacker', 'webcam-1', '', '../esp32-cam']) assert.equal(requestedSharedCamera(request(id)), null);
  assert.equal(requestedSharedCamera(new Request('http://web/health?camera=webcam-0&camera=esp32-cam')), null);
});

test('laptop selection overrides only this request identity, validates the actual worker and leaves global config unchanged', async t => {
  const names = ['SMARTPHSET_AI_CAMERA_ID', 'SMARTPHSET_AI_LIVE_ENABLED', 'SMARTPHSET_AI_LIVE_BASE_URL', 'SMARTPHSET_AI_RELAY_TOKEN'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { SMARTPHSET_AI_CAMERA_ID: 'esp32-cam', SMARTPHSET_AI_LIVE_ENABLED: 'true', SMARTPHSET_AI_LIVE_BASE_URL: 'http://python:8001', SMARTPHSET_AI_RELAY_TOKEN: '' });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls++;
    assert.equal(url, 'http://python:8001/health');
    assert.ok(!init.method || init.method === 'GET');
    return Response.json({ camera: 'webcam-0', streaming: true, status: 'ok' });
  });
  const { liveApi } = load('../src/lib/live-server.ts', {
    'server-only': {}, './shared-camera.ts': { requestedSharedCamera }, './session': { currentUser: session }, './live-proxy': { liveHandlers },
  });
  try {
    const laptop = request('webcam-0');
    const healthy = await liveApi(laptop)(laptop, false);
    assert.equal(healthy.status, 200);
    assert.deepEqual(await healthy.json(), { status: 'ok', camera: 'webcam-0', streaming: true });
    const esp = request('esp32-cam');
    const mismatch = await liveApi(esp)(esp, false);
    assert.equal(mismatch.status, 503);
    assert.equal((await mismatch.json()).status, 'source_mismatch');
    const invalid = request('http://attacker');
    assert.equal((await liveApi(invalid)(invalid, false)).status, 400);
    assert.equal(calls, 2);
    assert.equal(process.env.SMARTPHSET_AI_CAMERA_ID, 'esp32-cam');
  } finally { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } }
});

test('health and multipart identity must both match, for laptop and ESP32 workers', async () => {
  for (const actual of ['webcam-0', 'esp32-cam']) {
    for (const selected of ['webcam-0', 'esp32-cam']) {
      const handler = liveHandlers('http://python:8001', session, async url => url.endsWith('/health')
        ? Response.json({ status: 'ok', camera: actual, streaming: true })
        : new Response('jpeg', { headers: { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'X-SmartPhset-Camera-Id': actual } }), selected);
      for (const stream of [false, true]) {
        const response = await handler(request(selected), stream);
        assert.equal(response.status, actual === selected ? 200 : 503);
        if (actual !== selected) assert.equal((await response.json()).status, 'source_mismatch');
        else if (stream) { assert.equal(response.headers.get('x-smartphset-camera-id'), actual); await response.body.cancel(); }
      }
    }
  }
});

test('stopping a laptop AI viewer cancels only its stream; another viewer can continue', async () => {
  const cancelled = [];
  let viewers = 0;
  const handler = liveHandlers('http://python:8001', session, async url => {
    assert.equal(url, 'http://python:8001/stream.mjpg');
    const viewer = viewers++;
    return new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new TextEncoder().encode('--frame\r\n')); },
      cancel() { cancelled.push(viewer); },
    }, { highWaterMark: 0 }), { headers: { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'x-smartphset-camera-id': 'webcam-0' } });
  }, 'webcam-0');
  const one = await handler(request('webcam-0', 'stream'), true), two = await handler(request('webcam-0', 'stream'), true);
  const peer = two.body.getReader();
  await one.body.cancel();
  assert.deepEqual(cancelled, [0]);
  assert.ok((await peer.read()).value.length > 0);
  await peer.cancel(); assert.deepEqual(cancelled, [0, 1]);
  assert.equal((await liveHandlers('http://python', async () => null, () => assert.fail('anonymous upstream'), 'webcam-0')(request('webcam-0'), true)).status, 401);
});

test('metadata route authenticates and requests the selected camera without changing monitoring defaults', async () => {
  let authenticated = true, seen = [];
  const { GET } = load('../src/app/api/ai/live/detection/route.ts', {
    '@/lib/session': { currentUser: async () => authenticated ? {} : null },
    '@/lib/shared-camera': { requestedSharedCamera },
    '@/lib/monitoring-server': { monitoringApi: camera => {
      seen.push(camera);
      return monitoringHandlers({ baseUrl: 'http://spring', cameraId: camera ?? 'esp32-cam' }, session, async url => {
        assert.equal(new URL(url).searchParams.get('camera'), camera ?? 'esp32-cam');
        return Response.json(result(camera ?? 'esp32-cam'));
      });
    } },
  });
  for (const camera of ['webcam-0', 'esp32-cam', undefined]) {
    const response = await GET(request(camera, 'detection'));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).detection.camera_id, camera ?? 'esp32-cam');
  }
  assert.equal((await GET(request('http://attacker'))).status, 400);
  assert.deepEqual(seen, ['webcam-0', 'esp32-cam', undefined]);
  authenticated = false;
  assert.equal((await GET(request('webcam-0'))).status, 401);
});

test('actual laptop panel uses the selected stream and hides wrong-source health or saved metadata', () => {
  for (const [healthCamera, metadataCamera] of [['webcam-0', 'webcam-0'], ['webcam-0', 'esp32-cam'], ['esp32-cam', 'webcam-0']]) {
    const { LiveDetectionPanel } = load('../src/components/LiveDetectionPanel.tsx', {
      react: { ...React, useState: initial => React.useState(initial?.status === 'starting' ? { status: 'ok', streaming: true, camera: healthCamera } : initial) },
      '@/features/ai-alerts/aiDetectionApi': { useLiveCameraDetection: camera => {
        assert.equal(camera, 'webcam-0');
        return { data: { cameraId: metadataCamera, detection: result(metadataCamera) } };
      } },
      '@/features/ai-alerts/AISeverityBadge': { AISeverityBadge: () => null }, '@/features/ai-alerts/aiAlertTransitions': { isFreshDetection: () => true },
    });
    const html = renderToStaticMarkup(React.createElement(LiveDetectionPanel, { cameraId: 'webcam-0' }));
    assert.equal(html.includes('/api/ai/live/stream?camera=webcam-0'), healthCamera === 'webcam-0');
    assert.equal(html.includes('Matched saved detection'), healthCamera === 'webcam-0' && metadataCamera === 'webcam-0');
    if (healthCamera !== 'webcam-0') assert.ok(html.includes('Python is serving esp32-cam'));
  }
});
