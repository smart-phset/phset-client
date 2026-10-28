# Dynamic cameras and on-demand inference

Implemented incrementally alongside the existing camera APIs. No AWS infrastructure was changed. Existing uncommitted work was retained. Existing IoT controls, team/guest authentication, upload/photo analysis, legacy MJPEG APIs, severity policy and trained `models/best.pt` remain in place.

## Runtime architecture

1. Browser discovery: `enumerateDevices` on mount and after permission, plus `devicechange`. Start Camera alone invokes `getUserMedia`, using exact device IDs or front/rear facing constraints. Device IDs remain in browser memory; the tab saves only its source preference in sessionStorage. Pending permission requests are invalidated on switch/stop/unmount.
2. Registry: Spring manages an operator-configured list of shared IDs/labels. Its authenticated list/availability endpoints disclose no capture address and report `unknown` until runtime information is available. Next enriches the list from the worker's authenticated runtime status. Idle cameras are not probed or scanned. This deliberately distinguishes registration from verified availability.
3. Persistent worker: `session_service.py` loads the existing local YOLO model once (416 image size, original 0.4 confidence default). A single model lock serializes inference with zero queued jobs; busy browser frames receive 429 and shared workers drop that sample. Default maximum 16 analysis/view sessions, configurable up to 64; 32 simultaneous HTTP handlers. Sessions expire after 60 seconds without control/metadata/frame requests; a 2-second reaper releases abandoned captures. Each shared source owns one capture thread and one latest JPEG, independent of viewer count. Shared preview captures at 2 fps; inference happens only while at least one session opts in. It uses the existing capture timeout handling, overlay renderer, latest-frame MJPEG fan-out and bounded Spring publisher.
4. Browser AI: Start AI Detection opts in to JPEG transmission over authenticated same-origin Next routes. It reuses the preview stream; it never calls getUserMedia again. Frames fit within 960×720, JPEG quality .75, at selectable 1/2/5 fps maximum, one request in flight per tab. The worker enforces 512 KiB encoded size, 1280-pixel side bounds, 921600 decoded pixels and at most 5 submitted frames/sec/session before decoding. Results carry original-frame dimensions for the SVG overlay. The model runs across sessions one at a time, so simultaneous sessions share throughput; this is not a promise of parallel GPU execution or fairness under saturation.
5. Isolation: login-cookie hashes identify owners; random session IDs identify viewers. Each browser analysis has a separate opaque source identity, while shared source IDs identify registered hardware. Tabs sharing a login cookie still create separate sessions. Separate logins to the same team account have separate owners. Session access checks both owner and session ID. Monotonic command revisions reject late start/stop requests. Browser detections are returned only to their session and are not published into global grow-room alerts. Shared detections retain source-based Spring publishing once per source.
6. Cleanup: Stop AI ends uploads and clears session results while retaining preview. Stop Camera/switch/unmount/pagehide stops tracks, cancels the frame loop and closes only this viewer's session. Logout broadcasts cleanup to other tabs and attempts server-side closure of all sessions belonging to that login cookie. If the worker is unreachable, expiry provides cleanup after at most about 62 seconds without requests. Private service endpoints must not be exposed publicly.

A preview-only viewer of a shared camera may see an annotated JPEG if another viewer is analyzing that source; that viewer's own analysis remains off and has no detection metadata. Shared preview is continuously captured, so no second worker is started when analysis is enabled. The legacy `live_camera.py` remains available for existing deployments, but do not run it against a camera also owned by the new service.

## Configuration and startup

Do not copy real camera addresses or secrets into this document or frontend code. Export environment variables explicitly; Python and Spring do not automatically load these example env files. All credentials below are server-only; do not use NEXT_PUBLIC_. Use independently generated long random values for the service and registry keys, and protect the existing ingest key.

Spring (`api/`, JDK 25):

```sh
export SMARTPHSET_CAMERA_REGISTRY='esp32-cam=Grow room,worker-usb=Worker USB'
export SMARTPHSET_CAMERA_API_KEY='<registry-secret>'
# Retain existing database, auth, MQTT and AI_INGEST_KEY configuration.
./gradlew bootRun
```

Python (`SmartPhset-AI/`, existing Python 3.11 environment and requirements):

```sh
export SMARTPHSET_AI_SERVICE_KEY='<service-secret-at-least-32-characters>'
export SMARTPHSET_CAMERA_SOURCES='{"worker-usb":0}'
# Add esp32-cam's address to this operator-only JSON configuration on the AI host.
# No request parameter, registry entry or browser input may supply a capture URL.
export SMARTPHSET_BACKEND_URL='http://127.0.0.1:9090'
export SMARTPHSET_AI_INGEST_KEY='<existing-Spring-AI_INGEST_KEY>'
export SMARTPHSET_AI_MAX_SESSIONS=16
export SMARTPHSET_CONFIDENCE=0.4
.venv/bin/python session_service.py
```

The worker listens on 127.0.0.1:8002. Browser-only inference works with an empty source map. Configure optional worker-attached cameras explicitly by device index; this does not enumerate hardware on a remote browser. Shared IDs must exist in both the Spring registry and the worker's allowlist. Keep full stream URLs exclusively in the worker environment. Model override `SMARTPHSET_WEIGHTS` defaults to the existing weights if absent or empty.

Next (`SmartPhset-Prototype-Frontend/`, Node version from repository):

```sh
export SMARTPHSET_API_BASE_URL='http://127.0.0.1:9090'
export SMARTPHSET_CAMERA_API_KEY='<same-registry-secret>'
export SMARTPHSET_AI_SERVICE_URL='http://127.0.0.1:8002'
export SMARTPHSET_AI_SERVICE_KEY='<same-service-secret>'
# Retain AUTH_USER, AUTH_PASSWORD, AUTH_SECRET and ALLOW_GUEST settings.
npm run build -- --webpack
npm start -- --hostname 127.0.0.1 --port 3100
```

`SMARTPHSET_API_BASE_URL` selects Spring independently of `BACKEND_URL`, which can still point to the photo bridge. The new service does not require the legacy port-8001 relay. Existing `/api/ai/live/*` consumers remain on that legacy integration until explicitly migrated.

## API contracts

All browser routes require a verified SmartPhset login or permitted guest cookie, return `Cache-Control: no-store`, and reject cross-origin mutations. Guest camera analysis follows the existing guest viewing policy; guest IoT controls remain read-only. No browser receives service/registry/ingest keys. There are no registration or scan endpoints accepting viewer URLs.

| Application request | Request body | Response |
| --- | --- | --- |
| GET `/api/cameras` | — | `[{id,label,availability}]`; registry IDs enriched with `idle`, `starting`, `ok`, `camera_unavailable`, `stalled`, `inference_unavailable`, or `unknown` |
| POST `/api/cameras/sessions` | `{"source_id":"browser"}` or registered shared ID | 201 snapshot with opaque session ID; shared IDs checked against Spring and worker allowlists |
| GET `/api/cameras/sessions/{id}` | — | Owned snapshot and heartbeat, polled every 2 seconds |
| POST `/api/cameras/sessions/{id}/start` | `{"revision":1}` | Enables AI, clears prior result; latest revision wins |
| POST `/api/cameras/sessions/{id}/stop` | `{"revision":2}` | Disables this session's AI and clears result |
| POST `/api/cameras/sessions/{id}/frames` | Binary `image/jpeg`, ≤524288 bytes; `X-Camera-Revision` must match the latest start revision | Browser session only; synchronous detection snapshot; 429 means skip/retry later |
| GET `/api/cameras/sessions/{id}/stream` | — | Shared source only; authenticated MJPEG `boundary=frame`; startup waits up to 6 seconds for first frame |
| DELETE `/api/cameras/sessions/{id}` | — | Closes this session; last viewer releases capture |

Snapshot example (no frame has completed yet):

```json
{"session_id":"opaque-viewer-id","source_id":"browser-opaque-source-id","analyzing":true,"status":"DETECTING","detection":null}
```

Detection retains existing `verdict`, `message`, `severity`, counts, confidence fields, `boxes:[{label,conf,xyxy}]`, `shape:[height,width]`, `ms` and `captured_at`. Shared `source_id` is the registered ID. Unavailable shared sources suppress stale metadata. Preview status is LIVE only after local video starts or the shared image loads; AI status is DETECTING after enablement, with waiting/busy/error feedback.

Worker URLs mirror the session paths without `/api/cameras`; additional GET `/sources` returns configured runtime statuses, and DELETE `/sessions` closes all sessions for the supplied owner at logout. Every worker request requires `Authorization: Bearer <service-key>` and `X-Camera-Owner: <64-character-login-hash>`, supplied only by Next. Unauthorized/missing owner is 401; unknown/unowned session or source is 404; disabled analysis is 409; encoded/dimension limits are 413; invalid JPEG is 415; session/inference/sampling capacity is 429; unavailable capture/inference is 503. No public health endpoint reveals sources.

Spring GET `/api/cameras` and `/api/cameras/{id}/availability` require `X-SmartPhset-Camera-Key`. A missing configuration is 503; a wrong/missing credential is 401; unknown ID is 404. Spring Security permits routing to these GET handlers because the controller applies the same explicit server-to-server credential pattern as the existing IoT and AI integration.

## Validation and remaining acceptance

Automated results and exact touched files are listed below. Browser-camera scenarios are exercised through fake MediaDevices/tracks and component hooks; worker HTTP handlers are exercised with in-memory HTTP byte streams because this execution environment forbids listening sockets. These tests do not establish actual browser, camera or network behavior.

Deployment requirements:

- Run one Python service process with the existing model dependencies and weights. Multiple replicas would each own a model/capture; horizontal scaling needs sticky routing or a session store and coordinated capture ownership.
- Configure both server credentials and matching registry/source IDs. The registry is operator configuration, not a database-backed camera management UI. Idle cameras report unverified availability until opened.
- Put Next behind existing HTTPS ingress for laptop/phone camera APIs. Allow up to 512 KiB frame bodies and disable response buffering for MJPEG; retain cookies and same-origin protections. Maintain existing photo-upload limits separately.
- Keep Python loopback-only; use a private authenticated TLS relay/tunnel if Next is on another host. Keep Spring registry reachable only through approved server paths. Configure service supervision and restart-on-failure. SIGINT/SIGTERM stop the HTTP server and close captures with a bounded six-second join; abrupt shutdown releases OS devices but in-memory sessions are lost and viewers must restart.
- Re-run full Gradle and default Turbopack builds outside the sandbox; run the live HTTP/browser/hardware checks below before deployment. No production deploy or AWS change was performed.

Manual laptop/phone checklist (all actual hardware/browser checks remain unverified):

1. Over HTTPS, open Scan → Live Camera on a laptop. Verify integrated and plugged-in USB choices; unplug/replug and verify devicechange updates. Start preview: exactly one permission request and camera capture; no `/frames` requests yet.
2. Deny camera permission, then allow it and Retry. Occupy the device with another application to verify busy-camera feedback; close that application and Retry. Cancel a pending prompt via Stop Camera, then grant permission: no late preview or unreleased tracks.
3. Start AI: inspect only same-origin JPEG requests at the selected maximum sampling rate, one in flight. Verify boxes align at desktop/mobile aspect ratios, confidence/severity and inference timing update. Stop AI: frame requests stop, preview stays live. Start AI again: no second getUserMedia call.
4. Switch integrated→USB and local→shared while permission/inference requests are pending. Verify old tracks and requests stop, old detections disappear and no late result replaces the new source.
5. On an iPhone and Android phone over HTTPS, verify front/rear selection, rotation, responsive layout, permission rejection/retry, backgrounding and navigation cleanup. Plain HTTP on a LAN address must explain HTTPS requirements.
6. Use separate browsers/logins for the same account and two tabs sharing one cookie. Analyze laptop and phone cameras simultaneously; verify independent session and browser source IDs, results and Stop behavior. Under saturation verify bounded busy responses and recovery.
7. Two viewers select the same registered ESP32-CAM. Verify one capture and one inference sample per source, shared annotated MJPEG and source-based Spring publishing. Stop one viewer's AI/camera: the other continues. Stop the final viewer: capture releases. Add a second configured shared source and analyze it concurrently without restarting Python.
8. Disconnect ESP32 power/network. Verify OFFLINE and hidden stale detection metadata, bounded reconnect attempts and recovery. Disconnect USB: verify ended-track cleanup. Stop/restart a failed source without restarting the service.
9. Logout from Settings while camera analysis runs in another tab. Verify all local tracks/frames stop, worker-owned sessions close and old session IDs cannot be used with another login cookie. Close a tab abruptly and verify shared capture cleanup within about 62 seconds.
10. Repeat existing sign-in/guest and fan/light/pump regression checks against a test environment. Verify guest equipment controls remain read-only, AI severity publishing/alerts retain existing behavior and no private source URL or key appears in browser payloads or bundles.

## Executed checks (2026-10-28)

| Check | Result |
| --- | --- |
| Frontend `npm test` | 112 tests passed, including authentication, guest permissions, IoT switches, legacy MJPEG and new camera proxy/session regressions |
| Frontend `npm run lint` | Passed, zero warnings |
| Frontend `npm run typecheck` | Passed |
| Frontend `npm run build -- --webpack` | Passed, including route generation and TypeScript checking |
| Frontend default `npm run build` | Attempted; Turbopack cannot bind its internal CSS-processing port in this sandbox (`Operation not permitted`). No bundler/configuration changes were made to hide this failure. |
| Python `.venv/bin/python -m unittest discover -s tests -q` | 101 tests run; 100 passed, 1 existing live-backend integration test skipped because SMARTPHSET_INTEGRATION_BACKEND_URL is unset |
| Actual existing YOLO weights | Loaded once and inferred twice on synthetic 416×416 blank frames; both returned GREY, without camera hardware |
| Spring new registry test | Passed (1 JUnit test with authentication, registry validation and availability assertions); new controller and modified SecurityConfig compiled with JDK 25 and existing cached dependencies |
| Full Spring `./gradlew test --offline --no-daemon` | Blocked: default Gradle cache is read-only; writable-cache retry then failed on sandbox network/interface restrictions before test execution |
| Live HTTP and camera/browser checks | Unverified: sandbox prohibits listening sockets. New HTTP handlers were tested through in-memory HTTP requests; no laptop/USB/phone/ESP32 hardware was opened. |

The standalone Spring check used a temporary JUnit Platform launcher and cached dependency jars; it does not replace the full Spring integration/security/database suite. An additional sandboxed webpack retry encountered empty TypeScript subprocess output; direct webpack build execution succeeded. Re-run standard builds and Gradle tests in the deployment environment.

New Python tests exercise simultaneous inference saturation, distinct browser source/session identity, owner isolation, expiry, frame dimensions, authenticated HTTP lifecycle and JPEG-result association, stale command/frame rejection, logout closure, single shared capture reuse, final-viewer cleanup, concurrent shared sources and correct source-based publishing. Browser tests exercise single-capture ownership, permission/busy errors, late permission cleanup, independent viewer choices, source switching, frame-pump cancellation, bounded uploads and credential/URL isolation.

## Exact task file manifest

Paths are relative to the workspace root. This manifest lists files touched by this task, excluding unrelated pre-existing modifications and generated build/cache artifacts.

Python:

- `SmartPhset-AI/session_service.py` — added persistent model/session/capture/HTTP service.
- `SmartPhset-AI/tests/test_session_service.py` — added service lifecycle/concurrency/security tests.
- `SmartPhset-AI/.env.example` — appended worker configuration examples.

Spring:

- `api/src/main/java/com/smart/phset/api/feature/camera/CameraController.java` — added authenticated operator registry.
- `api/src/main/java/com/smart/phset/api/config/SecurityConfig.java` — routes registry GETs to controller credential checks.
- `api/src/main/resources/application.yaml` — added registry properties.
- `api/src/test/java/com/smart/phset/api/feature/camera/CameraControllerTests.java` — added registry assertions.
- `api/.env.example` — appended registry configuration examples.

Next:

- `SmartPhset-Prototype-Frontend/src/components/CameraManager.tsx` — dynamic choices, separate preview/AI controls, frame transport and detection overlay.
- `SmartPhset-Prototype-Frontend/src/components/CameraLogoutBridge.tsx` — added cross-tab logout notification.
- `SmartPhset-Prototype-Frontend/src/lib/camera-analysis.ts` — added cancellable serial frame pump and result contract.
- `SmartPhset-Prototype-Frontend/src/lib/camera-service.ts` — added authenticated bounded server proxy and registry enforcement.
- `SmartPhset-Prototype-Frontend/src/app/api/cameras/[[...path]]/route.ts` — added application camera endpoints.
- `SmartPhset-Prototype-Frontend/src/app/api/auth/signout/route.ts` — added worker session revocation before clearing login.
- `SmartPhset-Prototype-Frontend/src/app/(app)/layout.tsx` — mounts logout notification bridge.
- `SmartPhset-Prototype-Frontend/tests/camera-manager.test.mjs` — updated UI expectations and added frame-loop tests.
- `SmartPhset-Prototype-Frontend/tests/camera-service.test.mjs` — added authentication/upload/source/credential proxy tests.
- `SmartPhset-Prototype-Frontend/tests/system-regressions.test.mjs` — retained authentication/IoT regressions and adapted camera scenarios to session-based requests.
- `SmartPhset-Prototype-Frontend/.env.example` — appended server-only service settings.
- `SmartPhset-Prototype-Frontend/docs/camera-manager.md` — marked earlier preview-only description as historical and linked this guide.
- `SmartPhset-Prototype-Frontend/docs/dynamic-camera-inference.md` — this handoff, API contract, startup, validation and manual acceptance guide.
