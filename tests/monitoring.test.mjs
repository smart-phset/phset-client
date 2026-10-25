import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeviceState, parseDetection, parseReceipt, freshness, confirmsCommand, observeCommand, acceptCommand } from '../src/lib/monitoring.ts';
import { monitoringHandlers } from '../src/lib/monitoring-proxy.ts';
import { startMonitoringPoll } from '../src/lib/monitoring-poll.ts';
import { sign, verify } from '../src/lib/auth.ts';

const stamp = n => new Date(n).toISOString();
const now = Date.parse('2026-10-10T10:00:00Z');
const state = {
  device_id: 'grow-room-1', temperature_c: 25.2, humidity_percent: 55,
  soil_moisture_percent: 100, fan: false, light: false, pump: false,
  telemetry_captured_at: stamp(now), telemetry_received_at: stamp(now),
  state_captured_at: stamp(now), state_received_at: stamp(now),
};
const detection = {
  id: 'event-record', camera_id: 'esp32-cam', captured_at: stamp(now), created_at: stamp(now),
  verdict: 'camera_error', severity: 'GREY', message: 'Could not inspect',
  max_conf: 0, max_contaminated_conf: 0, n_healthy: 0, n_contaminated: 0,
};
const config = { baseUrl: 'http://backend.test:9090', iotKey: 'test-server-only-secret', deviceId: 'grow-room-1', cameraId: 'esp32-cam' };
const team = async () => ({ guest: false });
const request = (body = { on: true }, extra = {}) => new Request('http://site.test/api/monitoring/actuators/pump', {
  method: 'POST', headers: { Origin: 'http://site.test', 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
});

// Explicit fixtures test contracts only; never published to real Spring/MQTT.
test('device parser accepts null reports but strips floating soil; rejects malformed state', () => {
  assert.equal(parseDeviceState(state, 'grow-room-1').soil_moisture_percent, null);
  assert.equal(parseDeviceState({ ...state, temperature_c: null, fan: null }, 'grow-room-1').fan, null);
  for (const bad of [{ ...state, device_id: 'other' }, { ...state, pump: 'false' }, { ...state, humidity_percent: 101 },
    { ...state, state_captured_at: 'invalid' }, { ...state, temperature_c: NaN }, { ...state, temperature_c: undefined }]) {
    assert.throws(() => parseDeviceState(bad, 'grow-room-1'));
  }
});

test('freshness uses both actual timestamps, independent of successful polling', () => {
  assert.equal(freshness(stamp(now), stamp(now), now), 'active');
  assert.equal(freshness(stamp(now - 20_001), stamp(now), now), 'stale');
  assert.equal(freshness(stamp(now), stamp(now - 60_001), now), 'offline');
  assert.equal(freshness(null, stamp(now), now), 'unavailable');
  assert.equal(freshness(stamp(now + 6_000), stamp(now), now), 'unavailable');
});

test('command confirmation requires newer captured/received timestamps and matching state', () => {
  const pending = { target: true, sentAt: now + 1000, baselineCaptured: stamp(now), baselineReceived: stamp(now) };
  assert.equal(confirmsCommand({ ...state, pump: true }, 'pump', pending, now + 2000), false);
  const fresh = { ...state, pump: true, state_captured_at: stamp(now + 2000), state_received_at: stamp(now + 2000) };
  assert.equal(confirmsCommand(fresh, 'pump', pending, now + 3000), true);
  assert.equal(confirmsCommand({ ...fresh, pump: false }, 'pump', pending, now + 3000), false);
  assert.equal(confirmsCommand(fresh, 'pump', pending, now + 70_000), false);
});

test('receipt and AI contracts reject mismatches and unavailable detections stay GREY', () => {
  assert.throws(() => parseReceipt({ on: 'true', expires_at: 1, command_id: 'a' }, true));
  assert.throws(() => parseReceipt({ on: false, expires_at: 1, command_id: 'a' }, true));
  assert.equal(parseDetection(detection, 'esp32-cam').severity, 'GREY');
  assert.throws(() => parseDetection(detection, 'other-camera'));
  assert.throws(() => parseDetection({ ...detection, max_conf: 2 }, 'esp32-cam'));
  assert.throws(() => parseDetection({ ...detection, severity: 'GREEN' }, 'esp32-cam'));
});

test('state proxy sends server key, strips soil, disables caching and excludes upstream fields', async () => {
  let seen;
  const api = monitoringHandlers(config, team, async (url, init) => {
    seen = { url, init }; return Response.json({ ...state, secret_detail: config.iotKey });
  });
  const res = await api.state(), body = await res.json();
  assert.equal(seen.url, 'http://backend.test:9090/api/iot/devices/grow-room-1/state');
  assert.equal(seen.init.headers['X-SmartPhset-IoT-Key'], config.iotKey);
  assert.equal(seen.init.cache, 'no-store'); assert.equal(seen.init.redirect, 'error');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(body.state.soil_moisture_percent, null);
  assert.equal(body.soil.available, false); assert.equal(body.canControl, true);
  assert.ok(!JSON.stringify(body).includes(config.iotKey));
});

test('sessions and team role gate commands before any upstream request', async () => {
  const never = async () => { assert.fail('must not contact backend'); };
  assert.equal((await monitoringHandlers(config, async () => null, never).state()).status, 401);
  assert.equal((await monitoringHandlers(config, async () => ({ guest: true }), never).command(request(), 'pump')).status, 403);
  const guestState = await monitoringHandlers(config, async () => ({ guest: true }), async () => Response.json(state)).state();
  assert.equal((await guestState.json()).canControl, false);
});

test('cross-origin, malformed, oversized and arbitrary actuator requests are rejected locally', async () => {
  const api = monitoringHandlers(config, team, async () => { assert.fail('must not contact backend'); });
  assert.equal((await api.command(request({}, { Origin: 'http://evil.test' }), 'pump')).status, 403);
  assert.equal((await api.command(request({}, { 'Content-Type': 'text/plain' }), 'pump')).status, 400);
  for (const body of [{ on: 'true' }, { on: 1 }, {}, { on: true, extra: 'x' }, { on: true, padding: 'x'.repeat(200) }])
    assert.equal((await api.command(request(body), 'pump')).status, 400);
  assert.equal((await api.command(request(), '../state')).status, 400);
  assert.equal((await api.command(new Request('http://site.test/api', { method: 'POST', headers: {
    Origin: 'http://site.test', 'Content-Type': 'application/json' }, body: '{' }), 'pump')).status, 400);
});

test('accepted ON/OFF commands use exact Spring contract with no retries', async () => {
  for (const actuator of ['fan', 'light', 'pump']) for (const on of [true, false]) {
    let calls = 0;
    const api = monitoringHandlers(config, team, async (url, init) => {
      calls++; assert.equal(url, `${config.baseUrl}/api/iot/devices/grow-room-1/actuators/${actuator}`);
      assert.equal(init.method, 'POST'); assert.deepEqual(JSON.parse(init.body), { on });
      return Response.json({ on, expires_at: 1_800_000_000, command_id: 'command-id' }, { status: 202 });
    });
    assert.equal((await api.command(request({ on }), actuator)).status, 202); assert.equal(calls, 1);
  }
});

test('upstream errors are mapped without forwarding secrets or retrying commands', async () => {
  for (const [upstream, expected] of [[400, 400], [401, 502], [403, 502], [404, 404], [503, 503], [500, 502]]) {
    let calls = 0;
    const api = monitoringHandlers(config, team, async () => { calls++; return Response.json({ message: config.iotKey }, { status: upstream }); });
    const res = await api.command(request(), 'pump');
    assert.equal(res.status, expected); assert.equal(calls, 1);
    assert.ok(!(await res.text()).includes(config.iotKey));
  }
  const api = monitoringHandlers(config, team, async () => { throw new Error(config.iotKey); });
  const res = await api.command(request(), 'pump'); assert.equal(res.status, 503);
  assert.ok(!(await res.text()).includes(config.iotKey));
  assert.equal((await monitoringHandlers({ ...config, iotKey: '' }, team).state()).status, 503);
  assert.equal((await monitoringHandlers({ ...config, baseUrl: 'http://user:password@backend.test' }, team).state()).status, 503);
  assert.equal((await monitoringHandlers(config, team, async () => new Response('<html>oops</html>')).state()).status, 502);
  assert.equal((await monitoringHandlers(config, team, async () => Response.json({ on: true, expires_at: 1, command_id: 'id' })).command(request(), 'pump')).status, 502);
});

test('AI reads existing latest/history endpoints; no IoT key is sent to AI', async () => {
  const calls = [];
  const api = monitoringHandlers(config, team, async (url, init) => {
    calls.push(url); assert.equal(init.headers['X-SmartPhset-IoT-Key'], undefined);
    return Response.json(url.includes('/latest?') ? detection : [detection]);
  });
  assert.equal((await api.detection()).status, 200); assert.equal((await api.history()).status, 200);
  assert.deepEqual(calls, [`${config.baseUrl}/api/ai/detections/latest?camera=esp32-cam`, `${config.baseUrl}/api/ai/detections?camera=esp32-cam&limit=20`]);
  assert.equal((await monitoringHandlers({ ...config, cameraId: '' }, team).detection()).status, 503);
  const missing = await monitoringHandlers(config, team, async () => new Response(null, { status: 404 })).detection();
  assert.equal((await missing.json()).error, 'no_detection');
});

test('polling never overlaps, pauses hidden, resumes once and aborts on disposal', async () => {
  let visible = true, callback, resolveTask, signal, active = 0, maximum = 0, calls = 0;
  const timers = new Map(); let nextTimer = 0;
  const env = { visible: () => visible, later: (cb, delay) => { assert.equal(delay, 5000); timers.set(++nextTimer, cb); return nextTimer; },
    cancel: id => timers.delete(id), onVisibility: cb => { callback = cb; return () => { callback = null; }; } };
  const stop = startMonitoringPoll(async s => {
    signal = s; calls++; active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => { resolveTask = resolve; }); active--;
  }, env);
  assert.equal(calls, 1); callback(); callback(); assert.equal(calls, 1);
  resolveTask(); await new Promise(resolve => setImmediate(resolve)); assert.equal(timers.size, 1);
  visible = false; callback(); assert.equal(timers.size, 0);
  visible = true; callback(); assert.equal(calls, 2); assert.equal(maximum, 1);
  stop(); assert.equal(signal.aborted, true); assert.equal(callback, null);
  resolveTask(); await new Promise(resolve => setImmediate(resolve)); assert.equal(timers.size, 0);
});

test('existing signed session rejects forged team tokens; guest does not become a team account', async () => {
  const saved = { ...process.env };
  try {
    delete process.env.AUTH_PASSWORD; delete process.env.AUTH_SECRET; delete process.env.ALLOW_GUEST;
    assert.equal(await verify(await sign('admin')), null);
    assert.equal(await verify(await sign('guest')), 'guest');
    process.env.AUTH_PASSWORD = 'fixture-password'; process.env.AUTH_SECRET = 'fixture-signing-secret'; process.env.AUTH_USER = 'team';
    assert.equal(await verify(await sign('team')), 'team');
    assert.equal(await verify('team.forged'), null);
  } finally {
    for (const key of ['AUTH_PASSWORD', 'AUTH_SECRET', 'ALLOW_GUEST', 'AUTH_USER']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});

test('reports racing acceptance and late reports confirm without changing reported equipment state', () => {
  const pending = { target: true, sentAt: now + 1000, baselineCaptured: stamp(now), baselineReceived: stamp(now) };
  const sending = { phase: 'sending', message: 'Sending', pending };
  const report = { ...state, pump: true, state_captured_at: stamp(now + 2000), state_received_at: stamp(now + 2000) };
  const receipt = { command_id: 'id', on: true, expires_at: 1800000000 };
  assert.equal(acceptCommand(sending, receipt).phase, 'accepted');
  const observed = observeCommand(sending, report, 'pump', now + 3000);
  assert.equal(observed.phase, 'sending');
  assert.equal(acceptCommand(observed, receipt).phase, 'confirmed');
  const late = { ...report, state_captured_at: stamp(now + 25000), state_received_at: stamp(now + 25000) };
  assert.equal(observeCommand({ ...sending, phase: 'unconfirmed' }, late, 'pump', now + 26000).phase, 'confirmed');
  assert.equal(observeCommand(sending, state, 'pump', now + 3000), sending);
  const confirmed = acceptCommand(observed, receipt);
  assert.equal(observeCommand(confirmed, { ...report, pump: false }, 'pump', now + 4000), confirmed);
  assert.equal(report.pump, true); // Command tracking never mutates the actual report.
});
