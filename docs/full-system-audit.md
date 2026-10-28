# SmartPhset full-system audit — 2026-10-28

**Release decision: NOT READY for controlled AWS staging deployment yet.** Source
fixes and available isolated verification are complete; build/runtime, real browser,
physical integrations and secure AI connectivity remain release gates. No production
infrastructure, firmware, actuator state, commits or pushes were changed.

This record supersedes older validation claims for the current dirty source tree.
Existing work was retained on frontend `feat/grow-room-monitoring`, AI
`feat/live-camera`, and firmware `main`. API and web-cam stayed clean on `main`.
An initial source snapshot (excluding private env, dependencies, Git and model/image
artifacts) is in `/tmp/phset-audit-original/source.tar`. Private env was inspected
through safe booleans only and was not modified or printed.

## A. Findings and root causes

| Severity | Component | Finding and disposition |
| --- | --- | --- |
| Medium | Camera Manager | Initial React state and absent sessionStorage both selected Disabled, intentionally disabling Start/Stop. Changed a fresh tab to shared ESP32-CAM, still requiring explicit Start; retained explicitly saved Disabled. Enumerate devices on mount without asking permission. |
| Unverified | Reported camera screenshot | Selected shared option together with “Camera disabled” contradicts the controlled component's normal state. This sandbox cannot reproduce the actual browser, hydration, browser form restoration, or a stale host server. The default-state change is **not proof** that this exact discrepancy is resolved. Verify after a fresh build/start and hard reload. Added a JavaScript-required notice. |
| Medium | Live panel | Health streaming=true previously displayed LIVE before an image loaded. LIVE now requires image load, healthy producer and no stream error. Metadata severity additionally requires this current stream connection. Stalled producers have an explicit message; late health requests cannot update an unmounted panel. |
| Medium | Streaming proxy | The verified source identity was checked but not forwarded; contradictory health could expose streaming=true for a stalled source. Preserve X-SmartPhset-Camera-Id and require ok status. Existing native img, incremental pull, cancellation, no-store/no-transform and no-buffer headers remain. No evidence was found of whole-response MJPEG buffering in this proxy. |
| Medium | Python capture | Initially offline network capture exited into a wait-for-restart state instead of retrying. Serve mode now reaches the existing reconnect loop with one detector. Network capture now supplies FFmpeg open/read timeouts of 5 seconds, avoiding indefinite blocking before reconnect/shutdown. Physical FFmpeg/ESP32 behavior still needs verification. |
| High | Authentication | Signed username tokens had no server-enforced expiry and were identical across logins. Tokens now include signed 14-day expiry and random nonce, verified with HMAC verification. Old tokens fail closed and require sign-in again. Individual revocation remains unimplemented. |
| Medium | Authentication | Cross-site login was accepted; logout mutated state through GET. Login/logout reject cross-site Origin/Fetch Metadata. Logout is POST; all in-app controls and smoke tests use POST. |
| High | Reverse proxy integration | Comparing Origin only to the internal Next request URL can reject legitimate public HTTPS commands behind Docker/Nginx. A shared helper uses preserved public Host and overwritten forwarding protocol. Commands still require Origin, team membership, JSON and a known actuator. New tests dispatch no hardware requests. Only trusted ingress may reach Next. |
| Medium | System Status | Legacy demo rooms, upload bridge health and seeded photos were used to imply controller/AI/network health. Replaced with read-only Spring state and Python health snapshots plus actual metadata query state. No MQTT, Internet connectivity, physical-load or detection-accuracy claim is inferred. |
| Medium | Upload | App accepted unbounded bodies, lacked fetch deadlines/redirect controls, leaked exception details, and could synthesize demo results in production when unconfigured. Added 2 MiB encoded-body bound, JPEG requirement, cross-site guard, abort/30-second fetch timeout, redirect refusal and sanitized transport errors. Unconfigured production upload returns 503; labeled development demos remain available. Decoded-image limits in the separate bridge remain a deployment prerequisite. |
| Low | Scan UI/resources | Closed resized ImageBitmap, added browser upload deadline, and labeled recent cards as upload previews/examples rather than real saved Spring history. |
| Blocker | AWS AI read integration | Local Spring source permits reads without a dedicated read credential, while deployed ingress restricts them (per existing deployment documentation/user report). Frontend sends no ingestion credential on reads. This task could not obtain live HTTP responses; do not interpret a network failure as an observed 401/403. Required contract is described below. |
| Blocker | Execution environment | Turbopack cannot bind its CSS helper socket (EPERM). Webpack cannot parse the restricted TypeScript child process output. Neither result establishes a source-code build failure. Runtime also cannot bind 3100; Docker socket is denied. |

## B. Exact files changed during this audit

Paths below are relative to `SmartPhset-Prototype-Frontend` unless stated otherwise.
Pre-existing dirty files outside this list were left as found.

| Files | Purpose |
| --- | --- |
| `src/components/CameraManager.tsx`, `src/lib/browser-camera.ts` | Shared default, explicit-start lifecycle, initial device enumeration, no-JavaScript guidance; retain independent per-tab state and track ownership. |
| `src/components/LiveDetectionPanel.tsx`, `src/lib/live-proxy.ts` | Frame-load-aware status, stale/aborted health handling, source header, consistent upstream health. |
| `src/lib/auth.ts`, new `src/lib/request-origin.ts` | Expiring, unique signed tokens and public-host Origin validation behind trusted ingress. |
| `src/app/api/auth/signin/route.ts`, `src/app/api/auth/signout/route.ts` | Cross-site guards and POST logout and explicit historical-accuracy qualification. |
| `src/components/Shell.tsx`, `src/components/monitoring/GrowRoomDashboard.tsx`, `src/app/(app)/settings/page.tsx` | POST logout forms; treat real status page as monitoring. |
| `src/lib/monitoring-proxy.ts` | Preserve actuator Origin protection with the public reverse proxy host. No command/body/backend contract change. |
| `src/app/(app)/status/page.tsx`, `src/components/monitoring/PrototypeNotice.tsx`, `src/lib/store.tsx` | Replace misleading demo diagnostics; stop legacy reading simulation on Status. |
| `src/app/api/images/route.ts`, `src/lib/backend.ts`, `src/app/(app)/scan/page.tsx` | Upload bounds, deadlines, origin/redirect checks, sanitized failures, production no-demo fallback, bitmap release and preview labels. |
| `tests/actuator-switches.test.mjs`, `tests/camera-manager.test.mjs`, `tests/live.test.mjs`, `tests/production.test.mjs`, new `tests/system-regressions.test.mjs` | Update default/frame-load expectations; add actual component-handler and proxy/security regressions with isolated media/transports. |
| `scripts/production-smoke.mjs` | Exercise all major pages and POST logout. Existing invalid-actuator-only policy remains. |
| `README.md`, `docs/camera-manager.md`, `docs/production-acceptance.md`, `docs/production-validation.md`, `docs/production-deployment.md`, `docs/developer-guide.md`, this file | Current behavior, reproducible checks and remaining gates. |
| AI `live_camera.py`, `tests/test_live_stream.py` | Initial network recovery, finite network reads, two added regression tests. Existing `live_stream.py` dirty work was retained unchanged. |

## C. Actual validation

Baseline: all 6 frontend test files passed; lint passed. Python ran 93 tests:
92 passed and 1 opt-in Spring/PostgreSQL integration test skipped.

Final results are recorded below. Compose fixture configuration, entrypoint shell syntax and smoke-script syntax also pass. Component-hook
fixtures execute actual handlers/effects with fake browser APIs; they are not real
browser automation. No test sent a valid live actuator command.

| Check | Result |
| --- | --- |
| `npm run test` | PASS, 7 test files; direct execution of all files also passed 96 individual cases, zero failures. |
| `npm run lint` | PASS, zero warnings. |
| `npm run typecheck` | PASS when run against stable generated files. An initial concurrent build/typecheck raced `.next/types`; checks were then serialized relative to build. |
| `npm run build` | BLOCKED: Turbopack CSS helper process cannot bind a port (EPERM). |
| `npm run build -- --webpack` | BLOCKED on current environment: “Could not parse output from TypeScript's --showConfig.” Capability probe reports child EPERM/empty output. Older successful Webpack results are historical, not acceptance of this final source. |
| `npm run start -- --hostname 127.0.0.1 --port 3100` | BLOCKED: listen EPERM. |
| AI `.venv/bin/python -m unittest discover -s tests -v` | 95 run: 94 passed, 1 opt-in backend integration skipped. |
| Actual existing `models/best.pt` load + CPU inference on synthetic blank frame | PASS: 480×640 input, no_detection, approximately 310 ms for the measured inference. This is not throughput/accuracy/camera acceptance. |
| Live GET checks | Next :3100 and Python :8001 not reachable in this execution namespace; backend health/IoT/latest/history fetches could not reach the network. No HTTP result or telemetry freshness can be claimed. |
| Port owner | `/proc/net/tcp*` exposes no listener and process namespace shows no existing Next/Python server. Host PID/command cannot be identified here. No process was killed. |
| Docker build/start | NOT VERIFIED: daemon socket permission denied. |
| Real Chrome/mobile UI, console, MJPEG rendering and concurrent physical viewers | NOT VERIFIED: a local HTTP server cannot be bound. Browser executable availability alone does not establish an executable end-to-end environment. |
| Graceful shutdown, actual CPU/RSS/bandwidth and mobile performance | NOT VERIFIED. Network capture waits are bounded; production signal/stream behavior requires runtime checks. |

Final sequential build attempts both exited 1 with the environment errors above; the subsequent typecheck and lint exited 0.

All test/build stdout remains in `/tmp/phset-*.log` for this workspace session.

## Page-by-page disposition

| Feature | Source/integration review | Live browser/API acceptance |
| --- | --- | --- |
| Overview | Real Spring device state, timestamps, temperature/humidity, no installed soil sensor; errors do not substitute demo state. Team/guest actuator restrictions and receipt-versus-reported-state distinction remain. Existing isolated regressions pass. | Pending real authenticated GETs and browser rendering. |
| Climate | Reuses Overview's real dashboard. No separate simulated control implementation. | Pending; hardware commands deliberately not sent. |
| AI Scan / Live Detection | Independent tab source selection; shared source bypasses getUserMedia; local default/USB/front/rear constraints; Start/Stop, retry, late-permission cleanup and unmount tested in isolation. | Pending laptop/phone permission, device switch, refresh/hydration and actual stream tests. |
| Upload Image | Development examples labeled; production disabled/unconfigured returns 503, never a fake analysis. Bounded JPEG forwarding when configured. | Real bridge, image validation/model metadata and mobile decode limits pending. |
| Alerts | Real global saved-detection watcher; one 2-second query while focused, source/freshness checks; prototype alerts remain explicitly separated. | Protected Spring read access is a blocker. Toast/notification source tests pass. |
| Scan History | Real camera-filtered latest 20 Spring results, loading/errors, no demo history fallback. | Protected Spring read access is a blocker. |
| System Status | Now real read-only controller/Python snapshots, metadata readiness and explicit unknown/unavailable states. No invented Internet/MQTT/physical-load checks. | Pending real services and browser navigation. |
| Settings | Language/account preferences work by source review; per-tab camera guidance; POST logout. Prototype room/hardware/target descriptions remain labeled prototype content. | Pending responsive/mobile interaction. |
| Login/logout | Safe redirect, signed expiry/nonce, HMAC verification, guest policy, cookie flags and cross-site rejection tested; session still shared-account auth. | HTTPS/Nginx cookie acceptance, real browser logout capture cleanup and rate limiting pending. |

## D. Remaining limitations/security dependencies

1. Camera screenshot root cause still needs the actual browser/runtime. A controlled
   shared source should never render “Camera disabled”; hard reload the newly built
   server, inspect hydration/chunk failures, and verify sessionStorage source before
   calling this fully resolved. Local preferences are per-tab; device IDs are not
   persisted. Duplicated tabs may inherit an initial preference but never synchronize
   future changes. Two login tokens may be distinct, but browser tests remain pending.
2. Browser-local video is preview only, with no AI upload/inference. Phone capture
   needs trusted HTTPS. Shared source has no browser-camera permission dependency.
3. Backend read contract needed: a dedicated **read-only service credential**, e.g.
   `X-SmartPhset-AI-Read-Key`, accepted only for GET `/api/ai/detections/latest`
   and GET `/api/ai/detections`, with camera allowlist, missing/wrong credential
   rejection, bounded limits and read-only privilege. Next must forward it only from
   private server env; ingress must allow only the approved authenticated path.
   Keep existing POST ingestion and IoT security unchanged. This is a proposed
   coordinated API/ingress change, not an existing supported header or deployed fix.
4. Shared login has no per-session revocation store. Logout clears the cookie; a
   copied token can replay until expiry or AUTH_SECRET rotation. Rotating only the
   password does not revoke existing tokens with a stable independent AUTH_SECRET.
   Existing local password fails the production strength threshold; set a unique
   production password privately. Nginx login rate limits remain required.
5. Image bridge must enforce decoded-pixel limits before production uploads are
   enabled. This task bounds encoded input and request lifetimes; it does not audit
   all legacy bridge storage/model contracts or validate field accuracy.
6. Python has one detector/capture producer and one latest-frame slot, bounded
   publisher work, viewer frame skipping and socket write timeouts by source/tests.
   Real simultaneous viewers, slow/disconnected clients, FFmpeg timeouts and memory
   measurements remain unverified. Do not start a second worker against the same
   camera just to test viewer concurrency.

## E. Required local commands and manual acceptance

Run on the normal host, outside this restricted task environment. Preserve existing
private env; do not copy templates over it. First identify port ownership:

```bash
cd /home/ratanak/smart-phset/SmartPhset-Prototype-Frontend
lsof -nP -iTCP:3100 -sTCP:LISTEN
# For the PID printed above (do not paste credentials or full unrelated command lines):
ps -p PID -o pid,ppid,lstart,comm
readlink -f /proc/PID/cwd
# Only if this is a confirmed stale SmartPhset server, stop its original terminal
# with Ctrl+C or send SIGTERM to that verified PID. Never pkill node/next.
# Stop a dev server before building into the same .next directory.
npm run test
npm run lint
npm run typecheck
npm run build
# Diagnose this independently if the normal build fails:
npm run build -- --webpack
npm run typecheck
npm run start -- --hostname 127.0.0.1 --port 3100
```

In another terminal:

```bash
cd /home/ratanak/smart-phset/SmartPhset-AI
.venv/bin/python -m unittest discover -s tests -v
# Use the existing running AI process if its source/ID is correct. Otherwise,
# start ONE worker, keeping existing publishing env loaded privately:
.venv/bin/python live_camera.py --serve --host 127.0.0.1 --port 8001 \
  --source http://10.34.99.52:81/stream --device cpu
curl --fail --max-time 5 http://127.0.0.1:8001/health
# Continuous streams intentionally hit curl's time limit after receiving data:
curl --max-time 3 -D /tmp/phset-mjpeg.headers \
  http://127.0.0.1:8001/stream.mjpg -o /tmp/phset-mjpeg.bin
```

For frontend HTTP smoke, supply a private *raw runtime-format* env file rather than
credentials in arguments. The smoke script does not accept quoted dotenv semantics.
It never dispatches a valid actuator identifier:

```bash
cd /home/ratanak/smart-phset/SmartPhset-Prototype-Frontend
SMOKE_ENV_FILE=/ABSOLUTE/PRIVATE/runtime.env npm run test:production
```

Use `docs/production-acceptance.md` and record results: sign in freshly (old tokens
are invalid), navigate every page, check console/network at desktop and mobile
widths, then use three independent browser sessions under team. Start local preview
in one and shared ESP32 in another; change/stop each independently. Deny local
permission then retry; switch USB/front/rear; navigate to upload/another page,
refresh, logout and verify the OS camera indicator clears. For shared video inspect
matching health camera and X-SmartPhset-Camera-Id, moving annotated JPEGs, no false
LIVE before an image loads, matching or explicitly unavailable metadata. Disconnect
camera/network in a controlled local test, observe offline/stale state, reconnect
and retry. Two shared viewers must leave one Python producer; closing one viewer
must not stop the other. Verify production SIGTERM and restart on the normal Docker
host without changing AWS. No live ON command is authorized by this procedure.

Recommended architecture: Cloudflare DNS/TLS → EC2 Nginx → loopback-only frontend
Docker container; existing HTTPS Spring backend/MQTT unchanged. Keep ESP32 raw HTTP
on the private LAN. Use an always-on LAN AI host with one model worker, reached
through an outbound authenticated tunnel/private VPN and a restricted HTTPS
streaming relay. The relay must enforce a separate service bearer credential on
health and video, preserve camera identity, disable buffering/cache and bound
viewer resources. EC2/container loopback cannot reach the laptop. Keep shared AI
and uploads disabled until this connection is accepted. Pin the reviewed image
and retain the previous immutable image/env for rollback; validate Docker/Nginx,
TLS, limits, healthcheck and graceful shutdown before deployment approval.

Sources for deployment behavior: [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting),
[Docker Next standalone](https://docs.docker.com/guides/nextjs/), and
[Tailscale access controls](https://tailscale.com/docs/features/access-control).
No tunnel, DNS, AWS, production backend or Nginx configuration was applied.
