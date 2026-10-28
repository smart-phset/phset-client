# Reported-state equipment switches

Overview (`/`) and Climate (`/climate`) share `GrowRoomDashboard`. Each Fan, Light and Water Pump card now uses the same `ActuatorCard` / `ActuatorSwitch` implementation. The old Turn ON / Turn OFF buttons are removed.

## Files changed for this task

- `src/components/monitoring/ActuatorSwitch.tsx`: reusable reported-state switch and card, green ON track / white right thumb, grey OFF track / white left thumb, pending spinner/text, unavailable placeholder, device description, feedback and accessible native button activation.
- `src/components/monitoring/GrowRoomDashboard.tsx`: mounts the three switch cards, guards both command directions while pending/unavailable, and retains the existing REST transport, report observation and race protections. The read-only sign-in link disables prefetch so merely displaying it cannot invoke the sign-out endpoint.
- `src/lib/actuator-controls.ts`: pure derived availability/pending logic and existing 20-second confirmation timeout behavior. It stores no visual ON/OFF state.
- `src/lib/km.ts`: Khmer translations for switch labels, pending text, descriptions, permission/unavailable explanations and confirmation feedback.
- `tests/actuator-switches.test.mjs`: component and actual-dashboard callback/effect tests with isolated transport/clock boundaries.
- `docs/actuator-switches.md`: this flow and verification guide.

No packages were added. Existing AI Redux/RTK Query integration remains in place. Device monitoring retains its existing single five-second poller while the shared dashboard is visible; there is no extra Redux slice, device cache or second polling loop.

## Command and confirmation flow

1. A fresh, valid ESP32 report determines the switch's ON/OFF state. Team permission and proxy `canControl` must allow control.
2. Native button activation (click, Space or Enter) requests the opposite reported state through `POST /api/monitoring/actuators/{fan|light|pump}` with exactly `{ "on": true }` or `{ "on": false }`.
3. The existing authenticated server proxy sends the command to Spring's `/api/iot/devices/{configured-device}/actuators/{actuator}` using the server-only IoT key. Spring/MQTT protocols are unchanged; the browser never sends MQTT.
4. A synchronous in-flight ref guard blocks rapid duplicate callbacks before React can render. The existing command phase guard blocks both directions until confirmation or timeout.
5. HTTP 202 means accepted for delivery. The UI shows Turning on… / Turning off… and disables the switch. The thumb and `aria-checked` retain the latest actual ESP32 report, not the requested target.
6. Existing `observeCommand`, `confirmsCommand` and `acceptCommand` require a fresh matching report captured/received after the command and newer than the baseline. A report racing the HTTP response is retained. Acceptance never overwrites a subsequent report.
7. After the existing 20-second timeout, pending ends with a non-blocking warning. The latest report remains authoritative. A fresh valid state permits an explicit retry; there is no automatic command retry. Late matching reports can still resolve an unconfirmed command.
8. Later reports always update the visual state, even after confirmation. For the pump, the firmware's later OFF report returns the switch to OFF. There is no frontend pump shutdown timer or synthetic device state.

## Unknown, offline, read-only and errors

Freshness still uses the existing device rules: state becomes stale after 20 seconds and offline after 60 seconds; captured and received timestamps must both be usable. Backend/state errors, stale reports or null actuator values disable interaction and show Unavailable / Unknown, with a reason. A cached ON/OFF value may appear only as an explicitly historical "Last reported" value.

A known switch uses `role="switch"`, boolean `aria-checked`, its actuator name, `aria-busy`, linked descriptions, a visible focus outline and a native disabled button. An unknown current state renders a disabled question-mark placeholder button instead of assigning a false unchecked/OFF switch semantic. This avoids announcing an unknown actuator as OFF to assistive technology. Track/thumb animations and spinners respect reduced-motion preferences.

Guest/read-only users can view fresh reported ON/OFF values but cannot operate any switch. Server authorization remains authoritative. Existing proxy errors cover missing/incorrect IoT keys, MQTT/backend failures and invalid upstream responses; the dashboard retains last retrieved reports while disabling unavailable controls. Command errors display feedback without changing reported state.

## Validation

Run:

```sh
npm run test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Automated tests cover Fan/Light/Pump ON and OFF, HTTP acceptance versus report confirmation, rapid duplicate callbacks, report/receipt races, pump's later OFF report, late confirmation, timeout/retry, stale/offline/null reports, permission guards, API errors, native switch semantics, reduced motion and shared Climate controls. Existing monitoring/authentication/AI tests remain included. No fixture state or command is sent to a real backend.

For hardware verification after restarting the frontend:

1. Sign in with a permitted team account and open Overview. Check all three switches against the latest ESP32 state report; Climate should show the same shared controls.
2. Toggle Fan and Light in both directions. Verify one proxy POST per operation with the correct boolean, pending feedback after HTTP 202, and visual confirmation only when a newer matching report arrives.
3. Toggle Pump ON and watch it return OFF after firmware auto-shutdown is reported. The UI follows reports at its existing roughly five-second cadence.
4. Verify guest/read-only controls are disabled. For a disconnected or unknown device, controls should display unavailable state and a reason, rather than defaulting to OFF.
5. Check the 20-second timeout with an isolated test transport or controlled test device that does not confirm. Pending should end with a warning, retaining the report, and allow explicit retry only when fresh state is available.
6. Check Tab, Space and Enter, focus visibility, mobile layout and reduced motion. Existing AI detection/notification behavior should remain functional.

Physical actuator/load operation was not exercised during automated verification. ESP32-reported state remains a report of controller output, not a measurement of fan motion, illumination or water flow.

## Verification results

All requested checks passed: `npm run test` (all four test files, including 18 switch regressions), `npm run lint`, `npm run typecheck`, `npm run build` (optimized Next.js production build), and `git diff --check`.

Eleven Chrome checks passed against the production build using intercepted browser-only reports and command responses. These verified Space/Enter activation, receipt-versus-report behavior, duplicate prevention, Fan/Light ON/OFF, pump OFF reports, the full 20-second timeout and retry, MQTT errors, unavailable/null states, read-only permission, retained authentication and shared Climate controls. The final browser run reported no uncaught exceptions. All actuator requests were intercepted; no physical hardware was operated.

Test artifacts: `/tmp/smartphset-equipment-switches-desktop.png`, `/tmp/smartphset-equipment-switches-mobile.png`, and `/tmp/smartphset-equipment-switches-browser-report.json`.
