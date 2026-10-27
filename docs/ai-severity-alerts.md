# Real-time AI notifications

## Why the toast was missing

The old `observeDetection` only called `severityTransition` when a camera was already initialized. A first fresh AMBER or RED result was therefore stored silently. Later results at the same severity were correctly deduplicated, so an ongoing Yellow condition never produced any notification. The severity badge reads the RTK Query cache directly, which explains why the badge updated while no toast appeared. The GREY-to-hazard rule also suppressed usable warning results after an unknown state.

The existing watcher and toast container are mounted once beneath the same stable Redux Provider in the authenticated application layout. The toast container is fixed with z-index 100, above the header (40) and navigation (50); initial suppression was the cause, not z-index or a second store. The detection route already calls `monitoringApi().detection()` and uses server-only `SMARTPHSET_AI_CAMERA_ID`. The local environment was verified as `esp32-cam` without changing it.

The old `/alerts` page displayed prototype alerts from an unrelated store. It now defaults to a real **AI notifications** tab, with prototype alerts retained in a separate tab. The topbar bell and navigation badges use live notification unread counts.

## Current behavior

- Initial **fresh AMBER**: one Yellow warning toast and one notification entry.
- Initial **fresh RED**: one Red critical toast and one notification entry.
- Initial GREEN: silent baseline. Initial GREY: no contamination alert.
- GREEN → AMBER: warning. GREEN/AMBER → RED: critical. RED → AMBER: improving condition with inspection still recommended. RED/AMBER → GREEN: recovery.
- GREY is Unknown. GREY → AMBER/RED warns; GREY → GREEN never claims recovery. A usable state → GREY can show a neutral Unknown notice.
- Repeated IDs, unchanged severity, older/equal timestamps, malformed timestamps and stale results never create duplicate alerts. Each camera has its own baseline and bounded 64-ID window. React Strict Mode, polling and App Router navigation cannot replay notifications.
- Freshness is **15 seconds** from `captured_at`, allowing the approximately 5-second publication interval, 2-second frontend polling and normal transport latency. Captures more than 5 seconds ahead of the browser clock are rejected. Sync browser/camera/backend clocks. A stale initial result creates no baseline or notification; the next fresh hazard still warns.
- Failed requests do not fabricate contamination, unknown or recovery transitions. Cached data is not processed as a new result. A new fresh result after reconnect is compared with the last accepted state.
- Toasts use existing colors, severity labels/icons, camera ID and AI contamination confidence for Yellow/Red. They auto-dismiss after **7 seconds**, support keyboard dismissal, live announcements, reduced motion and mobile layout. At most three are visible.
- The AI notifications tab retains the **latest 100 events in Redux memory**, newest first. Dismissing/expiring a toast preserves its notification. Users can mark all read or clear notifications without resetting deduplication. Refreshing, signing out, or leaving/reloading the app clears this memory.
- AI wording indicates possible contamination and inspection guidance. It does not assert scientific confirmation. Backend severity remains authoritative; confidence is displayed, never converted to severity.

No frontend notification is saved to PostgreSQL, Spring, localStorage, sessionStorage, IndexedDB, cookies or runtime files. Existing backend detection storage/history stays intact. Existing prototype persistence is isolated from these AI notifications.

## Architecture and files

- `src/store/store.ts`, `hooks.ts`, `StoreProvider.tsx`: typed `configureStore`, API middleware, `setupListeners`, one stable provider, watcher and toast container.
- `src/features/ai-alerts/aiDetectionApi.ts`: `createApi` + `fetchBaseQuery`, authenticated same-origin `GET /api/ai/live/detection`, validated metadata, cache guard against older/equal captures and reused latest IDs. Views read cache state without subscribing to extra polling loops.
- `AIAlertWatcher.tsx`: single global 2-second polling subscriber, pauses unfocused polling, refetches on focus/reconnect, dispatches successful observations.
- `aiAlertTransitions.ts`: pure initial/transition rules, freshness and deduplication; nullable `from` distinguishes initial alerts without inventing a prior severity.
- `aiAlertSlice.ts`, `aiAlertSelectors.ts`: camera state, transient toasts, bounded in-memory notifications, read/clear actions.
- `AIToastContainer.tsx`, `AISeverityBadge.tsx`: toast presentation/expiry and GREEN/YELLOW/RED/UNKNOWN badge.
- `AINotificationCenter.tsx`, `AINotificationLink.tsx`: notification list, unread counter, clear/read controls and global bell.
- `src/app/(app)/layout.tsx`: verified team/guest session before mounting Redux alongside the existing prototype provider; no watcher on sign-in.
- `src/app/(app)/alerts/page.tsx`, `src/components/PrototypeAlerts.tsx`: AI notifications default tab and preserved prototype alerts tab.
- `src/components/Shell.tsx`, `monitoring/PrototypeNotice.tsx`: live unread badges and bell; real notifications view is not labeled as demo data.
- `src/components/LiveDetectionPanel.tsx`, `monitoring/GrowRoomDashboard.tsx`: shared metadata cache and freshness; independent stream/health status. Stream reconnect, upload workflow, telemetry and actuator controls are preserved.
- `src/app/api/ai/live/detection/route.ts`, `src/lib/live-server.ts`, `live-proxy.ts`: server-configured camera ID for detection and health metadata. No browser-controlled upstream URL or exposed keys.
- `.env.example`: ESP32 camera example; `webcam-0` remains supported by server configuration.
- `src/app/globals.css`: toast animation and reduced-motion styles.
- `package.json`, `package-lock.json`: Redux Toolkit and React Redux installed during initial implementation; no additional packages needed for this fix.
- `tests/ai-alerts.test.mjs`, `tests/live.test.mjs`: initial hazard alerts, transitions, stale/duplicate rejection, camera independence, cache/disconnect behavior, actual provider-rendered toasts, notification history/read/clear/expiry, and layout regressions.

## Live ESP32-CAM verification

1. Set server-only `SMARTPHSET_AI_CAMERA_ID=esp32-cam`, matching existing Spring detections, and restart the frontend. Retain private backend and Python stream URL settings. Laptop source uses `webcam-0`. Never put API keys in public environment variables.
2. Sign in or continue as a permitted guest. In DevTools Network, filter `detection`. Expect one request about every two seconds in a focused tab, including on Overview, Climate, Scan and History. Sign-in should not poll.
3. Verify response `cameraId` and `detection.camera_id` are `esp32-cam`, with `captured_at` less than 15 seconds old. A first AMBER result should immediately show a Yellow warning; a first RED result should show a critical toast. Initial GREEN is silent.
4. Keep the condition Yellow through several new detections: one notification, no repeated warnings. Escalate to RED and verify one critical alert. Use actual backend severity; a given reference image may not reliably produce every model severity.
5. Click the header bell or Alerts navigation. The **AI notifications** tab retains alerts after toasts disappear. Navigate with application links: no duplicate/replayed events. Mark all read and clear the list; these actions do not change the camera severity baseline.
6. Verify UNKNOWN for GREY/no_detection or stale metadata, with no healthy claim. Disconnect metadata access in DevTools Request Blocking (no service modification needed): no fabricated recovery. Reconnect and confirm only fresh new detections are processed.
7. Test close via Tab + Enter/Space, approximately seven-second expiry, mobile viewport, and reduced motion. MJPEG and metadata failures remain independent; upload mode and existing controls should still work.

## Deterministic localhost development demo

Open the localhost frontend, sign in, and paste the following into DevTools Console. It intercepts **only browser reads** of the detection endpoint, using a separate `dev-fixture-only` camera baseline. Nothing is sent to Spring, Python or the database. Run it only when testing UI behavior; fixture severity is not a crop observation.

```js
(() => {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) {
    throw new Error('Use the localhost development frontend');
  }
  window.stopAIAlertMock?.();
  const originalFetch = window.fetch;
  const cameraId = 'dev-fixture-only';
  const runId = crypto.randomUUID();
  const sequence = ['AMBER', 'AMBER', 'RED', 'RED', 'GREEN', 'GREY', 'AMBER'];
  const started = Date.now();
  let step = -1;
  let payload;
  window.fetch = async function(input, init) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin !== location.origin || url.pathname !== '/api/ai/live/detection') {
      return originalFetch.call(this, input, init);
    }
    // Six seconds per step: intermediate 2s polls repeat exactly the same detection.
    const next = Math.min(sequence.length - 1, Math.floor((Date.now() - started) / 6000));
    if (next !== step) {
      step = next;
      const severity = sequence[step];
      const captured_at = new Date().toISOString();
      payload = { cameraId, detection: {
        id: `dev-${runId}-${step}`, camera_id: cameraId, captured_at, created_at: captured_at,
        severity, verdict: severity === 'GREY' ? 'no_detection'
          : severity === 'GREEN' ? 'no_contamination_seen' : 'contamination_suspected',
        message: 'DEVELOPMENT FIXTURE — not a real crop observation',
        max_conf: 0.70, max_contaminated_conf: 0.70,
        n_healthy: severity === 'GREEN' ? 1 : 0,
        n_contaminated: severity === 'AMBER' || severity === 'RED' ? 1 : 0,
      }};
    }
    return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  };
  window.stopAIAlertMock = () => {
    window.fetch = originalFetch;
    delete window.stopAIAlertMock;
  };
})();
```

Keep the tab focused. Expect an immediate Yellow warning with 70% confidence, no repeated Yellow warning, one critical Red, one recovery, Unknown, and a new Yellow after Unknown. Click the bell to review the same events in the notifications tab. Toasts disappear after about seven seconds; entries remain until cleared/reloaded. After the final capture is over 15 seconds old the current badge becomes UNKNOWN.

Run `window.stopAIAlertMock()` or reload to restore real detection fetches. A full reload clears notification memory. There is no mock API endpoint or production configuration switch.

## Validation

Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` from this repository. The automated tests use isolated fixtures, never real actuator commands or detection writes. Browser verification uses intercepted responses and the existing team sign-in flow (guest access is disabled locally) to exercise the production frontend; live model/hardware classification is a separate manual check.

All five validation commands passed after this fix, including the optimized Next.js production build. Nine headless Chrome checks passed against that build: first AMBER visibility at 70% confidence and z-index 100, one 2s polling loop, navigation/deduplication, expiry with retained history, unchanged-severity suppression, RED escalation, mobile dismissal, disconnect/recovery, and read state. No browser runtime exceptions were recorded. Browser fixtures replaced detection/health reads only; live hardware classification was not tested.

Browser evidence from this run: `/tmp/smartphset-yellow-notification-desktop.png`, `/tmp/smartphset-red-notification-mobile.png`, and `/tmp/smartphset-notification-browser-report.json`. These are test artifacts, not runtime notification persistence.
