import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as monitoring from '../src/lib/monitoring.ts';
import { actuatorControl, commandIsPending, expireActuatorCommand } from '../src/lib/actuator-controls.ts';

const require = createRequire(import.meta.url);
const translate = (text, vars) => vars ? Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text) : text;
function component(relative, mocks = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const controls = { actuatorControl, commandIsPending, expireActuatorCommand };
const i18n = { useT: () => translate };
const { ActuatorSwitch, ActuatorCard } = component('../src/components/monitoring/ActuatorSwitch.tsx', {
  '@/lib/i18n': i18n, '@/lib/actuator-controls': controls,
});
const renderCard = props => renderToStaticMarkup(React.createElement(ActuatorCard, {
  actuator: 'fan', value: false, health: 'active', canControl: true, onChange() {}, ...props,
}));
const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  return React.Children.toArray(node.props?.children).map(child => find(child, predicate)).find(Boolean);
};
const start = Date.parse('2026-10-27T06:00:00Z');
const stamp = n => new Date(n).toISOString();
const report = (at = start, values = {}) => ({
  device_id: 'grow-room-1', temperature_c: 26, humidity_percent: 70, soil_moisture_percent: null,
  fan: false, light: false, pump: false,
  telemetry_captured_at: stamp(at), telemetry_received_at: stamp(at),
  state_captured_at: stamp(at), state_received_at: stamp(at), ...values,
});
// Run the actual dashboard callbacks/effects. Only React's hook scheduler and the
// network/clock boundaries are isolated; command and confirmation functions are real.
function dashboardHarness(t, { teamAccount = true, canControl = true, values = {} } = {}) {
  let clock = start;
  t.mock.method(Date, 'now', () => clock);
  const slots = [];
  let cursor = 0;
  const effects = [];
  let poll, tick;
  const previousWindow = globalThis.window;
  globalThis.window = { setInterval: callback => { tick = callback; return 1; }, clearInterval() {} };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous[i])) {
        slots[index] = deps;
        effects.push(callback);
      }
    },
  };
  let snapshot = { deviceId: 'grow-room-1', canControl, state: report(start, values), soil: { available: false } };
  let stateError = null;
  let commandImpl = async (actuator, on) => ({ command_id: `command-${actuator}`, on, expires_at: 1800000000 });
  const posts = [];
  const { GrowRoomDashboard } = component('../src/components/monitoring/GrowRoomDashboard.tsx', {
    react: hooks,
    'next/link': { default: 'a' }, '@/lib/i18n': i18n,
    './ActuatorSwitch': { ActuatorCard }, '@/lib/actuator-controls': controls,
    '@/features/ai-alerts/aiDetectionApi': { useLatestAIDetectionState: () => ({ isUninitialized: true }) },
    '@/features/ai-alerts/AISeverityBadge': { AISeverityBadge: () => null },
    '@/features/ai-alerts/aiAlertTransitions': { isFreshDetection: () => false },
    '@/lib/monitoring-poll': { startMonitoringPoll: (task, env, delay) => {
      assert.equal(delay, monitoring.POLL_MS); poll = task; return () => {};
    } },
    '@/lib/monitoring': { ...monitoring, browserJson: async (url, init) => {
      if (url === '/api/monitoring/state') { if (stateError) throw stateError; return snapshot; }
      assert.match(url, /^\/api\/monitoring\/actuators\/(fan|light|pump)$/);
      assert.equal(init.method, 'POST');
      const actuator = url.split('/').at(-1), on = JSON.parse(init.body).on;
      posts.push({ actuator, on });
      return commandImpl(actuator, on);
    } },
  });
  function render() {
    cursor = 0;
    const tree = GrowRoomDashboard({ deviceId: 'grow-room-1', teamAccount });
    effects.splice(0).forEach(effect => effect());
    return tree;
  }
  render();
  const card = actuator => {
    const tree = render();
    return find(tree, node => node.type === ActuatorCard && node.props.actuator === actuator).props;
  };
  const observe = async (values, at = clock) => {
    clock = at;
    snapshot = { ...snapshot, state: report(at, values) };
    await poll(new AbortController().signal);
    render();
  };
  return { render, card, observe, posts,
    initialPoll: async () => { await poll(new AbortController().signal); render(); },
    command: fn => { commandImpl = fn; },
    flush: async () => { await new Promise(resolve => setImmediate(resolve)); render(); },
    advance: at => { clock = at; tick(); render(); render(); },
    failState: async error => { stateError = error; await poll(new AbortController().signal); render(); },
    reconnect: async () => { stateError = null; await poll(new AbortController().signal); render(); },
  };
}

for (const actuator of ['fan', 'light', 'pump']) for (const before of [false, true]) {
  test(`${actuator} ${before ? 'ON → OFF' : 'OFF → ON'} waits for actual ESP32 report after HTTP acceptance`, async t => {
    const h = dashboardHarness(t, { values: { [actuator]: before } });
    await h.initialPoll();
    h.card(actuator).onChange(!before);
    await h.flush();
    const pending = h.card(actuator);
    assert.deepEqual(h.posts, [{ actuator, on: !before }]);
    assert.equal(pending.command.phase, 'accepted');
    assert.equal(pending.value, before); // HTTP 202/receipt never sets the reported state
    const html = renderCard(pending);
    assert.match(html, new RegExp(`aria-checked="${before}"`));
    assert.match(html, /disabled=""/);
    assert.match(html, before ? /Turning off/ : /Turning on/);
    await h.observe({ [actuator]: !before }, start + 5000);
    assert.equal(h.card(actuator).command.phase, 'confirmed');
    assert.equal(h.card(actuator).value, !before);
    assert.match(renderCard(h.card(actuator)), new RegExp(`aria-checked="${!before}"`));
  });
}
test('pump follows automatic OFF report without a frontend shutdown timer or extra command', async t => {
  const h = dashboardHarness(t);
  await h.initialPoll();
  h.card('pump').onChange(true); await h.flush();
  await h.observe({ pump: true }, start + 5000);
  assert.equal(h.card('pump').value, true);
  await h.observe({ pump: false }, start + 15_000);
  assert.equal(h.card('pump').value, false);
  assert.match(renderCard(h.card('pump')), /Automatically turns off after approximately 10 seconds/);
  assert.equal(h.posts.length, 1);
});
test('synchronous repeated callbacks and accepted pending commands block both directions', async t => {
  const h = dashboardHarness(t);
  await h.initialPoll();
  let accept;
  h.command((actuator, on) => new Promise(resolve => { accept = () => resolve({ command_id: 'id', on, expires_at: 1800000000 }); }));
  const staleCallback = h.card('fan').onChange;
  staleCallback(true); staleCallback(true); staleCallback(false);
  assert.equal(h.posts.length, 1);
  accept(); await h.flush();
  h.card('fan').onChange(false); h.card('fan').onChange(true);
  assert.equal(h.posts.length, 1);
});
test('a state report racing HTTP acceptance is preserved; acceptance does not overwrite pump auto-OFF', async t => {
  const h = dashboardHarness(t);
  await h.initialPoll();
  let accept;
  h.command((actuator, on) => new Promise(resolve => { accept = () => resolve({ command_id: 'id', on, expires_at: 1800000000 }); }));
  h.card('pump').onChange(true);
  await h.observe({ pump: true }, start + 5000);
  assert.equal(h.card('pump').command.reported, true);
  await h.observe({ pump: false }, start + 15_000);
  accept(); await h.flush();
  assert.equal(h.card('pump').command.phase, 'confirmed');
  assert.equal(h.card('pump').value, false);
});
test('confirmation timeout retains reported OFF, warns and permits one explicit retry', async t => {
  const h = dashboardHarness(t);
  await h.initialPoll();
  h.card('fan').onChange(true); await h.flush();
  await h.observe({ fan: false }, start + 15_000); // device available but target not reported
  h.advance(start + monitoring.CONFIRM_MS);
  assert.equal(h.card('fan').command.phase, 'unconfirmed');
  assert.equal(h.card('fan').value, false);
  assert.match(renderCard(h.card('fan')), /No matching ESP32 report arrived/);
  assert.doesNotMatch(renderCard(h.card('fan')), /Turning on/);
  h.card('fan').onChange(true); await h.flush();
  assert.equal(h.posts.length, 2);
});
test('late ESP32 confirmation resolves an unconfirmed command without a retry', async t => {
  const h = dashboardHarness(t);
  await h.initialPoll();
  h.card('light').onChange(true); await h.flush();
  h.advance(start + 21_000);
  assert.equal(h.card('light').command.phase, 'unconfirmed');
  await h.observe({ light: true }, start + 25_000);
  assert.equal(h.card('light').command.phase, 'confirmed');
  assert.equal(h.posts.length, 1);
});
test('offline/stale state disables ON and OFF and reconnect enables controls only after a fresh report', async t => {
  const h = dashboardHarness(t, { values: { fan: true } });
  await h.initialPoll();
  h.advance(start + monitoring.STALE_MS + 1);
  const card = h.card('fan');
  assert.equal(actuatorControl(card.value, card.health, card.canControl, card.command).reported, null);
  assert.match(renderCard(card), /Unavailable/);
  assert.doesNotMatch(renderCard(card), /role="switch"/); // no false ON/OFF semantics for unknown current state
  h.card('fan').onChange(false); h.card('fan').onChange(true);
  assert.equal(h.posts.length, 0);
  await h.observe({ fan: true }, start + 25_000);
  h.card('fan').onChange(false); await h.flush();
  assert.equal(h.posts.length, 1);
});
test('unknown actuator is not displayed as OFF and cannot send a command', async t => {
  const h = dashboardHarness(t, { values: { fan: null } });
  await h.initialPoll();
  const html = renderCard(h.card('fan'));
  assert.match(html, /Unknown/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /aria-checked="false"|>OFF</);
  h.card('fan').onChange(true);
  assert.equal(h.posts.length, 0);
});
for (const permission of [{ teamAccount: false, canControl: true }, { teamAccount: true, canControl: false }]) {
  test(`permissions block switches before fetch: ${JSON.stringify(permission)}`, async t => {
    const h = dashboardHarness(t, permission);
    await h.initialPoll();
    assert.match(renderCard(h.card('fan')), /Guest access is read-only/);
    const signIn = find(h.render(), node => node.props?.href === '/api/auth/signout');
    assert.equal(signIn.props.prefetch, false); // a read-only banner must never prefetch sign-out
    h.card('fan').onChange(true); h.card('fan').onChange(false);
    assert.equal(h.posts.length, 0);
  });
}
test('command API errors retain reports and show feedback; state API errors disable all switches', async t => {
  const h = dashboardHarness(t);
  await h.initialPoll();
  h.command(async () => { throw new monitoring.MonitoringError('command_unavailable', 'The MQTT broker is unavailable.', 503); });
  h.card('light').onChange(true); await h.flush();
  assert.equal(h.card('light').value, false);
  assert.equal(h.card('light').command.phase, 'error');
  assert.match(renderCard(h.card('light')), /The MQTT broker is unavailable/);
  await h.failState(new monitoring.MonitoringError('backend_authentication', 'Backend authentication failed.', 502));
  for (const device of monitoring.ACTUATORS) {
    const card = h.card(device);
    assert.equal(actuatorControl(card.value, card.health, card.canControl, card.command).disabled, true);
    h.card(device).onChange(true);
  }
  assert.equal(h.posts.length, 1);
  await h.reconnect();
  assert.equal(h.card('light').health, 'active');
});
test('switch uses native keyboard activation, accessible state/focus, disabled/pending guards and reduced motion', () => {
  let calls = 0, target;
  const View = ActuatorSwitch;
  const tree = View({ label: 'Fan', reported: false, describedBy: 'feedback', onChange: on => { calls++; target = on; } });
  assert.equal(tree.type, 'button');
  assert.equal(tree.props.type, 'button');
  assert.equal(tree.props.role, 'switch');
  assert.equal(tree.props['aria-checked'], false);
  assert.equal(tree.props['aria-describedby'], 'feedback');
  assert.match(tree.props.className, /focus-visible:outline/);
  assert.match(renderToStaticMarkup(tree), /motion-reduce:transition-none/);
  tree.props.onClick();
  assert.equal(calls, 1); assert.equal(target, true);
  for (const override of [{ disabled: true }, { pending: true }, { reported: null }]) {
    const disabled = View({ label: 'Fan', reported: false, onChange: () => calls++, ...override });
    assert.equal(disabled.props.disabled, true);
    disabled.props.onClick();
  }
  assert.equal(calls, 1);
});
test('all equipment cards use one reusable switch and Climate shares Overview without new polling or visual state storage', () => {
  const source = readFileSync(new URL('../src/components/monitoring/GrowRoomDashboard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Turn ON|Turn OFF/);
  assert.match(source, /ACTUATORS.map\(actuator => <ActuatorCard/);
  assert.match(readFileSync(new URL('../src/app/(app)/climate/page.tsx', import.meta.url), 'utf8'), /export \{ default \} from "\.\.\/page"/);
  const switchSource = readFileSync(new URL('../src/components/monitoring/ActuatorSwitch.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(switchSource, /fetch\(|setTimeout|setInterval|useState|localStorage/);
  assert.equal(renderCard({ actuator: 'fan' }).includes('role="switch"'), true);
  assert.equal(renderToStaticMarkup(React.createElement(ActuatorSwitch, { label: 'Pump', reported: true, onChange() {} })).includes('bg-tertiary-container'), true);
});
