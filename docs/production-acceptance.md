# Frontend acceptance record

Release candidate/image digest: __________  Source revision/dirty patch: __________
Tester/date: __________  HTTPS staging origin: __________
Laptop OS/browser/version: __________  Phone OS/browser/version: __________

All rows below are **PENDING manual/staging verification** unless a tester records
a result. The unit tests use synthetic fixtures and do not replace these checks.
No phone, real camera, production browser or physical actuator test was performed
in the restricted Codex environment. See production-validation.md for checks that
actually ran. Use the same `team` login on both devices. Never paste credentials,
private stream URLs, cookies or raw images into this record.

## Build and HTTP gates

| Check | Acceptance | Result/evidence |
| --- | --- | --- |
| Production build | `npm run build -- --webpack` passes for reviewed source | Pending for final audit source: both builds blocked by execution permissions; see full-system-audit.md |
| Container build | Exact image builds on Node 24.22.1 for EC2 architecture | Pending |
| Runtime | Non-root, healthy, loopback-only host port, resources within budget | Pending |
| Authentication | Signed-out pages redirect; private APIs 401; wrong login fails | Pending |
| Cookie/TLS | Trusted chain/hostname; Secure, HttpOnly, SameSite=Lax; HTTP redirects | Pending |
| Session policy | Guest disabled by default; intentionally enabled guest read-only | Pending |
| Safe command rejection | Invalid actuator + invalid Origin rejected; no valid commands sent | Pending |
| Monitoring GETs | Real source ID and advancing timestamps; disconnected/stale data labeled | Pending |
| Static/SSR assets | Sign-in, overview, Scan and Settings render without console/runtime errors | Pending |
| Signout | Cookie removed and protected pages gated; camera indicator turns off | Pending |
| Graceful stop/restart | Standalone image handles SIGTERM; no OOM/forced kill | Pending |

Run `scripts/production-smoke.mjs` as documented. It uses only invalid actuator
identifiers, even for Origin/guest tests. A command rejection does not prove a
physical relay/load responds. If valid fan/light/pump testing is approved later,
use safe wiring and verify telemetry independently; do not run load commands from
this checklist or assume a receipt is physical feedback.

## Local browser camera checks (laptop + Android + iPhone)

Use a trusted HTTPS staging origin with the reviewed Nginx camera Permissions-Policy.
A phone's HTTP LAN URL is insufficient. Check each supported browser separately.

1. Fresh tab: `/scan` selects shared ESP32-CAM with capture stopped and Start enabled. Select This Device's Camera. No camera
   prompt/capture occurs until Start. Network tools show no uploaded camera frames.
2. Press Start, allow permission and verify moving integrated-webcam preview.
   Verify actual camera label, LIVE, muted playback, inline video and separate
   AI-unavailable message. Local preview requires neither Python nor Spring.
3. Stop: hardware/browser camera indicator turns off. Repeat with USB camera using
   the dropdown. Changing the device stops the old camera before Start is pressed
   for the new choice. Unplug USB: show disconnected/missing-camera error, Retry
   or select another source without reloading the app.
4. Phone: Start front camera, Switch to rear, switch back. Verify actual field of
   view and label (facingMode is a hint), no fullscreen takeover, rotation and
   controls without horizontal overflow. Stop releases the phone camera.
5. Deny permission, verify actionable message, enable permission and Retry.
   Test camera already in use, no installed camera, unsupported API and insecure
   HTTP context where available; record unsupported platform cases explicitly.
6. Press Stop or change source while the permission prompt is still pending, then
   grant: no stale stream may appear. No hidden camera indicator may remain on.
7. With preview running: Disabled, source switch, Upload Image tab, navigate away,
   logout and close/navigate the document. Verify all tracks end. Reload restores
   only the source preference and always waits for Start. Check back/forward cache
   navigation also returns to a stopped preview.
8. Inspect network requests: getUserMedia preview must not trigger POST frames,
   recording, WebSockets or browser-camera inference. Explicit photo selection is
   a different legacy upload action, disabled in the production template.

## Same-account browser isolation

1. Laptop profile A signs in as team and starts integrated webcam. Phone/profile B
   signs in with the same account and selects shared ESP32-CAM (without relay it
   must clearly report disabled). Profile A remains local.
2. Change B to front/rear local camera and Stop; A selection and tracks stay intact.
   Open a second laptop/browser with a USB camera; it must remain independent.
3. Reload one tab: its source preference survives in sessionStorage, camera does
   not auto-start, and the other tab is unchanged. A duplicated tab may inherit
   the initial preference but does not synchronize changes or auto-capture.
4. Inspect storage: only the source preference is stored, no raw media, device IDs,
   secrets or AUTH_USER camera setting. Do not equate an identical team auth
   cookie with identical viewer state.

## Shared video and AI checks — blocked until secure relay is deployed

The production template intentionally disables shared video/photo analysis.
Do not enable it by exposing ESP32-CAM or the Python loopback HTTP listener.
After a separately approved authenticated relay passes its security checks:

1. Confirm exactly one Python capture/inference producer for the configured physical
   source before viewers connect. Open two independent viewers; producer count
   stays one and inference cadence does not multiply. Record process/service
   identity and capture/inference instrumentation, not only browser screenshots.
2. Verify annotated MJPEG, actual `esp32-cam` source ID, fresh verdict/severity,
   confidence and capture timestamp. If Spring reads remain blocked, metadata
   must remain explicitly unavailable; video must not show a different source's
   result. Do not open backend reads or send an ingestion key to fix this.
3. Stop/close viewer A; viewer B continues. Throttle A strongly; B remains current
   and Python frame storage/Next memory do not grow unbounded. Ensure A skips to
   recent frames rather than building a long backlog.
4. Disable camera/worker/network in an isolated test setup. Show camera unavailable,
   AI offline or network error; no demo footage or fake healthy results. Restore
   and Retry. A stale/latest saved result is labeled stale with unknown current
   severity. Check future timestamps and another camera's metadata are rejected.
5. Disconnect all viewers. Responses/connections close; the one shared producer
   remains under service lifecycle control. Confirm no per-viewer capture worker
   was started or stopped.
6. Relay without/with invalid service credential fails; browser unauthenticated
   video fails; user-supplied camera URLs cannot select another server fetch
   target. Check streams bypass browser/proxy/Cloudflare caches.

## Acceptance decision

Webpack build: Passed locally  HTTP: Pending  Browser: Pending  Mobile: Pending
Standalone container: Pending  Nginx/TLS: Pending  Physical IoT: Pending
Shared AI relay: Disabled / Pending  Authenticated AI reads: Pending
Known auth/session limitations reviewed: Pending

Decision: **NOT APPROVED FOR DEPLOYMENT** until required build/functional checks
pass. A limited release with browser-local preview and IoT monitoring can keep
shared video and photo analysis disabled, but requires an explicit review of the
remaining security findings and still must pass its build/runtime/device checks.
