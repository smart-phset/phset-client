import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import aiAlerts, { detectionObserved, toastDismissed, toastExpired, alertsCleared, notificationsRead, notificationsCleared } from '../src/features/ai-alerts/aiAlertSlice.ts';
import { severityTransition, DETECTION_FRESH_MS, TOAST_DURATION_MS } from '../src/features/ai-alerts/aiAlertTransitions.ts';
import { monitoringHandlers } from '../src/lib/monitoring-proxy.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
// Follow the existing tests: compile real TypeScript modules, isolate only boundaries.
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const js = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(filename), name);
    const resolved = [base, `${base}.ts`, `${base}.tsx`].find(p => existsSync(p));
    return load(resolved, mocks, cache);
  };
  new Function('require', 'module', 'exports', js)(localRequire, module, module.exports);
  return module.exports;
}
const now = Date.parse('2026-10-27T03:00:00Z');
const stamp = ms => new Date(ms).toISOString();
const detection = (severity, index = 0, camera = 'esp32-cam') => ({
  id: `d-${index}`, camera_id: camera, captured_at: stamp(now + index * 2000), created_at: stamp(now + index * 2000),
  severity, verdict: severity === 'GREY' ? 'no_detection' : severity === 'GREEN' ? 'no_contamination_seen' : 'contamination_suspected',
  message: 'Test-only result', max_conf: .9, max_contaminated_conf: .8, n_contaminated: 1, n_healthy: 1,
});
const makeStore = () => configureStore({ reducer: { aiAlerts } });
const observe = (store, d, observedAt = Date.parse(d.captured_at)) => store.dispatch(detectionObserved({ detection: d, observedAt }));
const alerts = store => store.getState().aiAlerts;

for (const [from, to, type] of [
  ['GREEN', 'AMBER', 'warning'], ['AMBER', 'RED', 'error'], ['GREEN', 'RED', 'error'],
  ['RED', 'GREEN', 'success'], ['AMBER', 'GREEN', 'success'], ['RED', 'AMBER', 'warning'],
]) {
  test(`${from} → ${to} creates exactly one ${type} toast`, () => {
    const store = makeStore();
    observe(store, detection(from));
    store.dispatch(alertsCleared()); // isolate this transition from any initial hazard notification
    observe(store, detection(to, 1));
    observe(store, detection(to, 2));
    assert.equal(alerts(store).toasts.length, 1);
    assert.equal(alerts(store).toasts[0].type, type);
    assert.equal(alerts(store).toasts[0].from, from);
    assert.equal(alerts(store).toasts[0].to, to);
    assert.equal(alerts(store).cameras['esp32-cam'].currentSeverity, to);
  });
}
test('unchanged severity, repeated IDs (including older IDs) and Strict Mode repeats do not duplicate', () => {
  const store = makeStore();
  observe(store, detection('GREEN'));
  observe(store, detection('GREEN', 1));
  assert.equal(alerts(store).toasts.length, 0);
  const red = detection('RED', 2);
  observe(store, red); observe(store, red);
  observe(store, { ...detection('AMBER', 3), id: 'd-0' });
  assert.equal(alerts(store).toasts.length, 1);
  assert.equal(alerts(store).cameras['esp32-cam'].currentSeverity, 'RED');
});
test('out-of-order, equal timestamp, stale, malformed time and far-future captures are ignored', () => {
  const store = makeStore();
  observe(store, detection('GREEN', 2));
  const baseline = alerts(store);
  for (const d of [detection('RED', 1), { ...detection('RED', 3), captured_at: stamp(now + 4000) },
    { ...detection('RED', 3), captured_at: 'invalid' }, detection('RED', 200)]) {
    observe(store, d, now + 4000);
    assert.equal(alerts(store), baseline);
  }
  observe(store, detection('RED', 3), now + DETECTION_FRESH_MS + 6001);
  assert.equal(alerts(store), baseline);
});
test('initial historical result and first fresh result establish no historical alerts', () => {
  const store = makeStore();
  observe(store, detection('RED'), now + DETECTION_FRESH_MS + 1);
  assert.equal(alerts(store).toasts.length, 0);
  assert.equal(alerts(store).cameras['esp32-cam'], undefined);
  observe(store, detection('GREEN', 40));
  assert.equal(alerts(store).toasts.length, 0);
});
test('GREY is unknown, preserves last valid severity, and never claims recovery', () => {
  const store = makeStore();
  observe(store, detection('RED'));
  store.dispatch(alertsCleared());
  observe(store, detection('GREY', 1));
  assert.equal(alerts(store).cameras['esp32-cam'].currentSeverity, 'GREY');
  assert.equal(alerts(store).cameras['esp32-cam'].lastValidSeverity, 'RED');
  assert.equal(alerts(store).toasts[0].type, 'info');
  assert.doesNotMatch(alerts(store).toasts[0].message, /healthy|recover/i);
  observe(store, detection('GREEN', 2));
  assert.equal(alerts(store).toasts.length, 1);
  assert.equal(alerts(store).cameras['esp32-cam'].previousSeverity, 'RED');
  assert.equal(severityTransition('GREY', 'GREEN'), null);
});
test('camera IDs have independent severity baselines', () => {
  const store = makeStore();
  observe(store, detection('GREEN'));
  observe(store, detection('RED', 1, 'webcam-0'));
  assert.equal(alerts(store).toasts.length, 1);
  assert.equal(alerts(store).toasts[0].cameraId, 'webcam-0');
  observe(store, detection('AMBER', 2));
  assert.equal(alerts(store).toasts.length, 2);
  assert.equal(alerts(store).cameras['webcam-0'].currentSeverity, 'RED');
});
test('dismiss, expiry, maximum visible count and clear retain deduplication baselines', () => {
  const store = makeStore();
  for (let i = 0; i < 6; i++) observe(store, detection(i % 2 ? 'RED' : 'GREEN', i));
  assert.equal(alerts(store).toasts.length, 3);
  const [first, second] = alerts(store).toasts;
  store.dispatch(toastExpired({ id: first.id, now: first.createdAt + TOAST_DURATION_MS - 1 }));
  assert.equal(alerts(store).toasts.length, 3);
  store.dispatch(toastExpired({ id: first.id, now: first.createdAt + TOAST_DURATION_MS }));
  store.dispatch(toastDismissed(second.id));
  assert.equal(alerts(store).toasts.length, 1);
  store.dispatch(alertsCleared());
  observe(store, detection('RED', 5));
  assert.equal(alerts(store).toasts.length, 0);
});
test('global watcher uses one 2s polling subscription; errors do not dispatch cached results; remounts do not replay', t => {
  t.mock.method(Date, 'now', () => now + 4000);
  const store = makeStore();
  let response = { data: { detection: detection('GREEN') }, fulfilledTimeStamp: now };
  const { AIAlertWatcher } = load('src/features/ai-alerts/AIAlertWatcher.tsx', {
    react: { useEffect: fn => fn() },
    '@/store/hooks': { useAppDispatch: () => store.dispatch },
    './aiDetectionApi': { useGetLatestAIDetectionQuery: (arg, options) => {
      assert.equal(arg, undefined);
      assert.deepEqual(options, { pollingInterval: 2000, skipPollingIfUnfocused: true });
      return response;
    } },
  });
  AIAlertWatcher(); AIAlertWatcher();
  response = { ...response, isError: true };
  AIAlertWatcher();
  assert.equal(alerts(store).cameras['esp32-cam'].currentSeverity, 'GREEN');
  assert.equal(alerts(store).toasts.length, 0);
  response = { data: { detection: detection('RED', 1) }, fulfilledTimeStamp: now + 2000 };
  AIAlertWatcher(); AIAlertWatcher();
  store.dispatch(alertsCleared());
  // A page change re-renders the same global tree/cache; duplicate observations remain harmless.
  AIAlertWatcher();
  assert.equal(alerts(store).toasts.length, 0);
  response = { data: { detection: detection('GREEN', 2) }, isError: true };
  AIAlertWatcher();
  assert.equal(alerts(store).cameras['esp32-cam'].currentSeverity, 'RED');
});
test('RTK Query shares in-flight requests/cache, refetches safely after disconnect and validates camera metadata', async t => {
  const NativeRequest = globalThis.Request;
  t.mock.method(globalThis, 'Request', class extends NativeRequest {
    constructor(input, init) { super(typeof input === 'string' ? new URL(input, 'http://frontend.test') : input, init); }
  });
  let requests = 0, offline = false, result = detection('GREEN');
  t.mock.method(globalThis, 'fetch', async request => {
    requests++;
    assert.equal(request.url, 'http://frontend.test/api/ai/live/detection');
    assert.equal(request.credentials, 'same-origin');
    if (offline) return Response.json({ error: 'backend_unavailable' }, { status: 503 });
    return Response.json({ cameraId: result.camera_id, detection: result });
  });
  const { aiDetectionApi: api } = load('src/features/ai-alerts/aiDetectionApi.ts');
  const store = configureStore({ reducer: { aiAlerts, [api.reducerPath]: api.reducer }, middleware: g => g().concat(api.middleware) });
  const first = store.dispatch(api.endpoints.getLatestAIDetection.initiate());
  const second = store.dispatch(api.endpoints.getLatestAIDetection.initiate());
  try {
    await Promise.all([first, second]);
    assert.equal(requests, 1);
    observe(store, first.unwrap ? (await first.unwrap()).detection : result, now);
    offline = true;
    await first.refetch();
    const failed = api.endpoints.getLatestAIDetection.select()(store.getState());
    assert.equal(failed.isError, true);
    assert.equal(alerts(store).toasts.length, 0);
    assert.equal(alerts(store).cameras['esp32-cam'].currentSeverity, 'GREEN');
    offline = false; result = detection('RED', 1);
    observe(store, (await first.refetch().unwrap()).detection, now + 2000);
    assert.equal(alerts(store).toasts[0].type, 'error');
    result = detection('GREEN'); // delayed older response must not regress the UI cache
    const delayed = await first.refetch().unwrap();
    assert.equal(delayed.detection.severity, 'RED');
    result = { ...detection('GREEN', 2), id: 'd-1' }; // reused ID with a mutated capture
    assert.equal((await first.refetch().unwrap()).detection.severity, 'RED');
    first.unsubscribe();
    const third = store.dispatch(api.endpoints.getLatestAIDetection.initiate());
    await third;
    assert.equal(requests, 5);
    third.unsubscribe();
  } finally { second.unsubscribe(); store.dispatch(api.util.resetApiState()); }
});
test('actual toast has an accessible close button, live role and schedules seven-second expiry', t => {
  const store = makeStore();
  observe(store, detection('GREEN')); observe(store, detection('RED', 1));
  const toast = alerts(store).toasts[0];
  let closing = false;
  const effects = [];
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => { timers.push({ fn, delay }); return timers.length; });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(Date, 'now', () => toast.createdAt);
  const { AIToastCard } = load('src/features/ai-alerts/AIToastContainer.tsx', {
    react: { useEffect: fn => effects.push(fn), useState: () => [closing, v => { closing = v; }] },
    '@/store/hooks': { useAppDispatch: () => store.dispatch },
  });
  const tree = AIToastCard({ toast });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-label="Dismiss Critical AI detection"/);
  assert.match(html, /esp32-cam/);
  effects.splice(0).forEach(fn => fn());
  assert.ok(timers.some(t => t.delay === TOAST_DURATION_MS));
  const findButton = node => node?.type === 'button' ? node : React.Children.toArray(node?.props?.children).map(findButton).find(Boolean);
  findButton(tree).props.onClick();
  assert.equal(closing, true);
  AIToastCard({ toast }); effects.splice(0).forEach(fn => fn());
  timers.find(t => t.delay === 200).fn();
  assert.equal(alerts(store).toasts.length, 0);
});
test('configured ESP32 camera routes through existing authenticated proxy without hardcoded webcam or browser URL input', async () => {
  const source = readFileSync(path.join(root, 'src/app/api/ai/live/detection/route.ts'), 'utf8');
  assert.match(source, /monitoringApi\(camera\)\.detection\(\)/);
  assert.doesNotMatch(source, /webcam-0|searchParams/);
  const api = monitoringHandlers({ baseUrl: 'http://spring.test', cameraId: 'esp32-cam', deviceId: '', iotKey: 'secret' },
    async () => ({ guest: true }), async url => {
      assert.equal(url, 'http://spring.test/api/ai/detections/latest?camera=esp32-cam');
      return Response.json(detection('AMBER'));
    });
  const body = await (await api.detection()).json();
  assert.equal(body.cameraId, 'esp32-cam');
  assert.equal(body.detection.camera_id, 'esp32-cam');
});
test('badge maps backend AMBER/GREY to YELLOW/UNKNOWN and metadata errors never show GREEN', () => {
  const { AISeverityBadge } = load('src/features/ai-alerts/AISeverityBadge.tsx');
  for (const [severity, label] of [['GREEN', 'GREEN'], ['AMBER', 'YELLOW'], ['RED', 'RED'], ['GREY', 'UNKNOWN']]) {
    assert.match(renderToStaticMarkup(React.createElement(AISeverityBadge, { severity })), new RegExp(`>${label}<`));
  }
  const { LiveDetectionView } = load('src/components/LiveDetectionPanel.tsx');
  for (const props of [{ metadataError: true }, { metadataFresh: false }]) {
    const html = renderToStaticMarkup(React.createElement(LiveDetectionView, {
      health: { streaming: true, status: 'ok' }, detection: detection('GREEN'), onRetry() {}, onStreamError() {}, streamVersion: 0, ...props,
    }));
    assert.match(html, /Current AI severity: UNKNOWN/);
    assert.match(html, /src="\/api\/ai\/live\/stream"/);
  }
});
test('one authenticated provider owns global watcher/toasts; panels use query hooks without persisting alerts', () => {
  const read = p => readFileSync(path.join(root, p), 'utf8');
  const layout = read('src/app/(app)/layout.tsx');
  assert.match(layout, /if \(!user\) redirect\("\/signin"\)/);
  assert.equal((layout.match(/<AIStoreProvider>/g) ?? []).length, 1);
  const provider = read('src/store/StoreProvider.tsx');
  assert.equal((provider.match(/<AIAlertWatcher/g) ?? []).length, 1);
  assert.equal((provider.match(/<AIToastContainer/g) ?? []).length, 1);
  for (const file of ['src/components/LiveDetectionPanel.tsx', 'src/components/monitoring/GrowRoomDashboard.tsx']) {
    assert.doesNotMatch(read(file), /fetch\("\/api\/ai\/live\/detection|browserJson.*\/api\/monitoring\/detection/);
    assert.match(read(file), /useLatestAIDetectionState|useLiveCameraDetection/);
  }
  assert.doesNotMatch(read('src/app/layout.tsx'), /AIAlertWatcher|AIStoreProvider/);
  for (const file of ['src/store/store.ts', 'src/features/ai-alerts/aiAlertSlice.ts', 'src/features/ai-alerts/AIToastContainer.tsx'])
    assert.doesNotMatch(read(file), /localStorage|sessionStorage|indexedDB|persistReducer|document.cookie/);
});

for (const [severity, type] of [['AMBER', 'warning'], ['RED', 'error']]) {
  test(`initial fresh ${severity} immediately creates exactly one contamination notification`, () => {
    const store = makeStore();
    const first = detection(severity);
    observe(store, first, now + 7000); // normal publication/poll/transport latency
    const toast = alerts(store).toasts[0];
    assert.equal(toast.type, type);
    assert.equal(toast.from, null);
    assert.equal(toast.confidence, first.max_contaminated_conf);
    assert.equal(toast.capturedAt, first.captured_at);
    assert.equal(alerts(store).notifications.length, 1);
    observe(store, first, now + 8000); // Strict Mode, next poll, or navigation
    observe(store, detection(severity, 1), now + 9000);
    assert.equal(alerts(store).toasts.length, 1);
    assert.equal(alerts(store).notifications.length, 1);
  });
  test(`stale ${severity} never produces a notification; a later fresh ${severity} does`, () => {
    const store = makeStore();
    observe(store, detection(severity), now + DETECTION_FRESH_MS + 1);
    assert.equal(alerts(store).toasts.length, 0);
    assert.equal(alerts(store).notifications.length, 0);
    observe(store, detection(severity, 10), now + 20_000);
    assert.equal(alerts(store).toasts.length, 1);
  });
}
for (const severity of ['GREEN', 'GREY']) {
  test(`initial ${severity} does not create a contamination notification`, () => {
    const store = makeStore();
    observe(store, detection(severity));
    assert.equal(alerts(store).toasts.length, 0);
    assert.equal(alerts(store).notifications.length, 0);
  });
}
test('fresh AMBER or RED following unknown must notify without claiming recovery', () => {
  for (const [severity, type] of [['AMBER', 'warning'], ['RED', 'error']]) {
    const store = makeStore();
    observe(store, detection('GREY'));
    observe(store, detection(severity, 1));
    assert.equal(alerts(store).toasts.length, 1);
    assert.equal(alerts(store).toasts[0].type, type);
    assert.doesNotMatch(alerts(store).toasts[0].message, /confirmed|recovered/i);
  }
});
test('notification tab retains events after toast expiry/dismiss, can mark read/clear, and never replays cleared events', () => {
  const store = makeStore();
  observe(store, detection('AMBER'));
  const first = alerts(store).toasts[0];
  store.dispatch(toastExpired({ id: first.id, now: now + TOAST_DURATION_MS }));
  assert.equal(alerts(store).toasts.length, 0);
  assert.equal(alerts(store).notifications.length, 1);
  assert.equal(alerts(store).notifications[0].read, false);
  store.dispatch(notificationsRead());
  assert.equal(alerts(store).notifications[0].read, true);
  observe(store, detection('RED', 1));
  store.dispatch(toastDismissed(alerts(store).toasts[0].id));
  assert.equal(alerts(store).notifications.length, 2);
  store.dispatch(notificationsCleared());
  observe(store, detection('RED', 1));
  observe(store, detection('RED', 2));
  assert.equal(alerts(store).notifications.length, 0);
  assert.equal(alerts(store).toasts.length, 0);
  assert.deepEqual(alerts(makeStore()).notifications, []); // a reload/new store has no retained alerts
});
test('notification memory is bounded to 100 most recent events without suppressing escalation', () => {
  const store = makeStore();
  for (let i = 0; i < 105; i++) observe(store, detection(i % 2 ? 'RED' : 'AMBER', i));
  assert.equal(alerts(store).notifications.length, 100);
  assert.equal(alerts(store).notifications[0].capturedAt, detection('AMBER', 104).captured_at);
  assert.equal(alerts(store).toasts.length, 3);
});
test('actual Redux provider renders an initial YELLOW toast above shell content and retains it in the notifications tab', () => {
  const store = makeStore();
  const d = { ...detection('AMBER'), max_contaminated_conf: 0.70 };
  observe(store, d);
  const { AIToastContainer } = load('src/features/ai-alerts/AIToastContainer.tsx');
  const html = renderToStaticMarkup(React.createElement(Provider, { store }, React.createElement(AIToastContainer)));
  for (const value of ['AI severity notifications', 'fixed', 'z-[100]', 'YELLOW', 'Possible contamination', '70%', 'esp32-cam', 'role="status"', 'Dismiss'])
    assert.ok(html.includes(value), value);
  const { AINotificationCenter } = load('src/features/ai-alerts/AINotificationCenter.tsx');
  store.dispatch(toastDismissed(alerts(store).toasts[0].id));
  const center = renderToStaticMarkup(React.createElement(Provider, { store }, React.createElement(AINotificationCenter)));
  for (const value of ['AI notifications', '1 unread', 'Possible contamination', '70%', 'esp32-cam', 'Mark all read', 'Clear notifications'])
    assert.ok(center.includes(value), value);
});

test('selected Python camera metadata has isolated cache entries and requests the selected physical identity', async t => {
  const NativeRequest = globalThis.Request;
  t.mock.method(globalThis, 'Request', class extends NativeRequest {
    constructor(input, init) { super(typeof input === 'string' ? new URL(input, 'http://frontend.test') : input, init); }
  });
  const requested = [];
  let wrongSource = false;
  t.mock.method(globalThis, 'fetch', async request => {
    const camera = new URL(request.url).searchParams.get('camera');
    requested.push(camera);
    const actual = wrongSource && camera === 'webcam-0' ? 'esp32-cam' : camera;
    return Response.json({ cameraId: actual, detection: detection('GREEN', 0, actual) });
  });
  const { aiDetectionApi: api } = load('src/features/ai-alerts/aiDetectionApi.ts');
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: g => g().concat(api.middleware) });
  const one = store.dispatch(api.endpoints.getLatestAIDetection.initiate('webcam-0'));
  const two = store.dispatch(api.endpoints.getLatestAIDetection.initiate('esp32-cam'));
  try {
    assert.equal((await one.unwrap()).detection.camera_id, 'webcam-0');
    assert.equal((await two.unwrap()).detection.camera_id, 'esp32-cam');
    assert.deepEqual(requested.sort(), ['esp32-cam', 'webcam-0']);
    assert.equal(api.endpoints.getLatestAIDetection.select('webcam-0')(store.getState()).data.cameraId, 'webcam-0');
    assert.equal(api.endpoints.getLatestAIDetection.select('esp32-cam')(store.getState()).data.cameraId, 'esp32-cam');
    wrongSource = true;
    t.mock.method(console, 'error', () => {}); // RTK reports the deliberately invalid response.
    await assert.rejects(one.refetch().unwrap());
    assert.equal(api.endpoints.getLatestAIDetection.select('webcam-0')(store.getState()).isError, true);
    assert.equal(api.endpoints.getLatestAIDetection.select('esp32-cam')(store.getState()).isError, false);
  } finally { one.unsubscribe(); two.unsubscribe(); store.dispatch(api.util.resetApiState()); }
});

test('live camera hook reuses a matching global watcher and polls a different source without changing alerts', () => {
  const global = { data: { cameraId: 'esp32-cam' } }, selected = { data: { cameraId: 'webcam-0' } }, calls = [];
  const { useLiveCameraDetection } = load('src/features/ai-alerts/aiDetectionApi.ts', {
    '@reduxjs/toolkit/query/react': { fetchBaseQuery: () => ({}), createApi: () => ({
      endpoints: { getLatestAIDetection: { useQueryState: () => global } },
      useGetLatestAIDetectionQuery: (arg, options) => { calls.push({ arg, ...options }); return selected; },
    }) },
  });
  assert.equal(useLiveCameraDetection('esp32-cam'), global);
  assert.equal(calls[0].skip, true);
  assert.equal(useLiveCameraDetection('webcam-0'), selected);
  assert.equal(calls[1].arg, 'webcam-0');
  assert.equal(calls[1].skip, false);
  assert.equal(calls[1].pollingInterval, 2000);
  assert.equal(calls[1].skipPollingIfUnfocused, true);
  assert.equal(global.data.cameraId, 'esp32-cam');
});
