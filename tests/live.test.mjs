import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { liveHandlers } from '../src/lib/live-proxy.ts';
import { monitoringHandlers } from '../src/lib/monitoring-proxy.ts';
const require = createRequire(import.meta.url);
// Compile actual components using the project's TypeScript compiler; isolate only
// application providers/router. No browser or extra test runtime is required.
function component(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const { AISeverityBadge } = component('../src/features/ai-alerts/AISeverityBadge.tsx');
const { LiveDetectionView, LiveDetectionPanel } = component('../src/components/LiveDetectionPanel.tsx', {
  '@/features/ai-alerts/aiDetectionApi': { useLatestAIDetectionState: () => ({}) },
  '@/features/ai-alerts/AISeverityBadge': { AISeverityBadge },
  '@/features/ai-alerts/aiAlertTransitions': { isFreshDetection: () => true },
});
const detection = { id: 'one', camera_id: 'webcam-0', captured_at: '2026-10-25T00:00:00Z', created_at: '2026-10-25T00:00:00Z',
  verdict: 'contamination_suspected', message: 'Possible contamination', severity: 'RED', n_healthy: 2, n_contaminated: 1, max_conf: .92, max_contaminated_conf: .92 };
const view = overrides => renderToStaticMarkup(React.createElement(LiveDetectionView, {
  health: { status: 'ok', streaming: true }, detection, metadataError: false, streamError: false, streamVersion: 0, onStreamError() {}, onRetry() {}, ...overrides,
}));

test('live view renders internal continuous stream, verdict, counts and timestamp', () => {
  const html = view({});
  for (const value of ['LIVE', 'webcam-0', '/api/ai/live/stream', 'Possible contamination', 'RED', '92%', 'Healthy count', 'Contaminated count', detection.captured_at]) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('127.0.0.1'));
});
test('offline, camera failure, connecting, no-detection and metadata errors remain independent', () => {
  for (const [status, message] of [['offline', 'Live AI service is offline.'], ['camera_unavailable', 'Camera unavailable.'], ['starting', 'Connecting to live camera...']]) {
    const html = view({ health: { status, streaming: false } });
    assert.ok(html.includes(message)); assert.ok(!html.includes('<img'));
  }
  for (const override of [{ detection: null }, { detection: { ...detection, verdict: 'no_detection', n_healthy: 0, n_contaminated: 0 } }, { metadataError: true }]) {
    const html = view(override);
    assert.ok(html.includes('<img')); assert.ok(html.includes(override.metadataError ? 'Detection metadata unavailable' : 'No detection'));
  }
  assert.ok(view({ streamError: true }).includes('Reconnecting'));
});
test('Mushroom Health defaults to live and still renders upload controls in upload mode', () => {
  for (const mode of ['live', 'upload']) {
    const room = { id: 'r1', name: 'Room 1' };
    const { default: Page } = component('../src/app/(app)/scan/page.tsx', {
      react: { ...React, useState: initial => React.useState(initial === 'live' ? mode : initial) },
      'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
      'next/navigation': { useRouter: () => ({ push() {} }) },
      '@/components/LiveDetectionPanel': { LiveDetectionPanel },
      '@/components/ScanPhoto': { ScanPhoto: () => null },
      '@/lib/data': {}, '@/lib/i18n': { useT: () => text => text },
      '@/lib/store': { useStore: () => ({ scans: [], rooms: [room], room, live: false, setRoom() {} }) },
    });
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.ok(html.includes('Live Detection')); assert.ok(html.includes('Upload Image'));
    assert.ok(html.includes('accept="image/jpeg,image/png"'));
    assert.equal(html.includes('Upload a photo'), mode === 'upload');
    assert.equal(html.includes('Connecting to live camera...'), mode === 'live');
  }
});
const request = () => new Request('http://frontend.test/api/ai/live/stream');
const session = async () => ({ guest: true });
test('proxy streams chunks without buffering, preserves multipart and cancels upstream', async () => {
  let cancelled = false, pulls = 0;
  const stream = new ReadableStream({ pull(c) { pulls++; c.enqueue(new TextEncoder().encode('--frame\r\n')); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const api = liveHandlers('http://private-ai.test:8001', session, async (url, init) => {
    assert.equal(url, 'http://private-ai.test:8001/stream.mjpg'); assert.equal(init.cache, 'no-store');
    assert.equal(init.headers, undefined);
    return new Response(stream, { headers: { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame' } });
  });
  const response = await api(request(), true);
  assert.equal(pulls, 0);
  assert.equal(response.headers.get('content-type'), 'multipart/x-mixed-replace; boundary=frame');
  assert.match(response.headers.get('cache-control'), /no-store/);
  const reader = response.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), '--frame\r\n');
  await reader.cancel(); assert.equal(cancelled, true);
});
test('proxy authenticates, handles offline, sanitizes health and upstream errors', async () => {
  const unauthorized = liveHandlers('http://ai.test', async () => null, async () => assert.fail());
  assert.equal((await unauthorized(request(), true)).status, 401);
  for (const transport of [async () => { throw new Error('private-secret'); }, async () => new Response('private-secret', { status: 503 })]) {
    const response = await liveHandlers('http://ai.test', session, transport)(request(), true);
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private-secret'));
  }
  const response = await liveHandlers('http://ai.test', session, async () => Response.json({ status: 'ok', streaming: true, secret: 'private-secret' }), 'esp32-cam')(request(), false);
  assert.deepEqual(await response.json(), { status: 'ok', camera: 'esp32-cam', streaming: true });
});
test('live metadata uses webcam-0 with existing Spring contract and no ingestion credentials', async () => {
  const api = monitoringHandlers({ baseUrl: 'http://spring.test', cameraId: 'webcam-0', deviceId: '', iotKey: 'private-secret' }, session, async (url, init) => {
    assert.equal(url, 'http://spring.test/api/ai/detections/latest?camera=webcam-0');
    assert.ok(!JSON.stringify(init.headers).includes('private-secret')); return Response.json(detection);
  });
  assert.deepEqual((await (await api.detection()).json()).detection, detection);
});
test('client sources and available browser chunks contain no live server config or ingestion key', () => {
  const source = readFileSync(new URL('../src/components/LiveDetectionPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /process\.env|getUserMedia|SMARTPHSET_AI_LIVE_BASE_URL|INGEST_KEY/);
  const root = new URL('../.next/static/', import.meta.url);
  let files = [];
  try { files = readdirSync(root, { recursive: true }).filter(p => p.endsWith('.js')); } catch { /* build may not exist yet */ }
  for (const file of files) assert.doesNotMatch(readFileSync(new URL(file, root), 'utf8'), /SMARTPHSET_AI_LIVE_BASE_URL|SMARTPHSET_AI_INGEST_KEY|NEXT_PUBLIC_AI_INGEST_KEY/);
});

test('/scan actual mode buttons switch from default live to upload and back', () => {
  const states = [];
  let cursor = 0;
  const room = { id: 'r1', name: 'Room 1' };
  const { default: Page } = component('../src/app/(app)/scan/page.tsx', {
    react: { ...React, useRef: () => ({ current: null }), useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    } },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/components/LiveDetectionPanel': { LiveDetectionPanel },
    '@/components/ScanPhoto': { ScanPhoto: () => null },
    '@/lib/data': {}, '@/lib/i18n': { useT: () => text => text },
    '@/lib/store': { useStore: () => ({ scans: [], rooms: [room], room, live: false, setRoom() {} }) },
  });
  const render = () => { cursor = 0; return Page(); };
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const result = find(child, predicate);
      if (result) return result;
    }
  }
  let tree = render();
  for (const mode of ['live', 'upload', 'live']) {
    if (mode === 'upload' || states[0] === 'upload') {
      find(tree, node => node.type === 'button' && node.props.children === (mode === 'upload' ? 'Upload Image' : 'Live Detection')).props.onClick();
      tree = render();
    }
    assert.equal(Boolean(find(tree, node => node.type === LiveDetectionPanel)), mode === 'live');
    const html = renderToStaticMarkup(tree);
    assert.equal(html.includes('Take or upload a bag photo'), mode === 'upload');
    assert.equal(html.includes('Take photo'), mode === 'upload');
    assert.equal(html.includes('No AI server is connected'), mode === 'upload');
    assert.ok(html.includes('Recent scans'));
  }
});

test('scan and real notifications suppress prototype banners for guests and members', () => {
  for (const path of ['/scan', '/alerts']) {
    const navigation = { usePathname: () => path };
    const i18n = { useT: () => text => text, useLang: () => ({ lang: 'en', setLang() {} }) };
    const link = { default: ({ children, ...props }) => React.createElement('a', props, children) };
    const { PrototypeNotice } = component('../src/components/monitoring/PrototypeNotice.tsx', {
      'next/navigation': navigation, 'next/link': link, '@/lib/i18n': i18n,
    });
    assert.equal(renderToStaticMarkup(React.createElement(PrototypeNotice)).includes('Prototype preview'), false);
    const { Topbar } = component('../src/components/Shell.tsx', {
      'next/navigation': navigation, 'next/link': link, '@/lib/i18n': i18n,
      '@/features/ai-alerts/AINotificationLink': { AINotificationLink: () => null, AINotificationCount: () => null },
      '@/lib/store': { useStore: () => ({ updatedAgo: 0, reading: { online: true }, live: false,
        room: { id: 'r1', name: 'Room 1' }, rooms: [], statusOf: () => 'ok' }) },
    });
    for (const guest of [true, false]) {
      const html = renderToStaticMarkup(React.createElement(Topbar, { user: { name: 'Test', guest } }));
      assert.equal(html.includes('Demo data'), false);
      assert.equal(html.includes('Demo · updated'), false);
    }
  }
});
