> The preview-only design below describes the earlier integration. The new camera manager supports dynamic shared discovery and on-demand browser/shared AI sessions. See [Dynamic camera inference](dynamic-camera-inference.md) for current behavior, API contracts, startup and acceptance tests.

# Camera selection MVP

## Sources and isolation

Open `/scan` → Live Detection. Camera Manager offers Disabled, This Device's
Camera, Laptop Webcam — AI Stream, and ESP32-CAM. Overview and Settings link to the same manager; camera
capture logic is implemented once. The initial source is ESP32-CAM, with capture stopped. An explicitly saved Disabled preference is retained. Start is always
required, including after reload. Stop, disable, source changes, upload-tab
navigation, logout/unmount and pagehide release local tracks. Late permission
responses are discarded. Switching front/rear while running releases the old
camera before requesting the new one. Device dropdown changes stop preview;
press Start for the newly selected device.

`sessionStorage` stores only the source preference for this tab, not AUTH_USER,
video, device IDs or credentials. It survives reloads but does not synchronize
other tabs or devices. A duplicated tab may inherit the initial preference;
subsequent changes are independent and neither tab starts automatically.
`localStorage` would propagate a preference across same-origin tabs, so it is
not used. Storage restrictions do not prevent in-memory operation.

A viewer is this mounted browser component and its stream owner. No server-side
viewerSessionId is needed for local preview: media never leaves the browser.
Do not use username, browser deviceId or a client-generated ID as authorization.
Any future server analysis needs an opaque, server-issued viewerSessionId tied
to the authenticated session, distinct from the physical cameraSourceId.

Available device IDs are enumerated on mount without requesting permission, then refreshed after permission and on device changes, never saved
across sessions. Missing IDs revert to the default choice; stale exact IDs fail
with a recoverable error. Facing mode is a browser hint; the running stream's
track label identifies the actual camera when available. AI analysis is explicitly
unavailable for local preview; no frame-upload endpoint is invoked.

## Shared architecture

ESP32-CAM (private LAN) → one Python capture/YOLO worker → one latest annotated
JPEG → loopback MJPEG service → authenticated Next.js streaming proxy → viewers.

All viewers consume the same producer; HTTP handlers never capture or infer.
The latest-frame slot bounds frame storage. Slow viewers skip intermediate frames,
independent handlers have socket write timeouts, and a disconnected consumer does
not stop the producer. The Next proxy pulls without an application queue and
cancels upstream reads on response cancellation/request abort. Browser Stop removes
the stream image and health polling. Stale Python frames are not replayed.

`local` is direct browser preview; `laptop-ai` selects Python `webcam-0`;
`shared` retains the existing ESP32-CAM preference and selects `esp32-cam`.
The selected shared ID is passed on health, stream and saved-metadata requests;
only these two known IDs are accepted. The upstream Python URL remains server
configuration, never a viewer-supplied URL. Each shared view checks `/health`
and the MJPEG `X-SmartPhset-Camera-Id` header before showing video.
`SMARTPHSET_AI_CAMERA_ID` still controls global grow-room alerts/history and
requests without an explicit camera; choosing a tab source does not change it.
`cameraAvailability` comes from Python health and browser/stream errors.
`analysisStatus` is separate: local unavailable, shared inference available or
unavailable, and metadata current/stale/unavailable. Python sends its source ID in
health and X-SmartPhset-Camera-Id on MJPEG. Next rejects mismatches; the panel only
shows metadata whose camera ID matches health. Severity is unknown when metadata
is stale (15 seconds), the feed is down, or metadata reads fail. Saved stale values
are labeled separately. Global alerts/history remain for the configured shared
grow-room source, regardless of personal preview selection.

The existing Spring publisher, ingestion key and YOLO pipeline are preserved.
Guests with a valid allowed guest session retain existing read-only camera access;
unsigned requests receive 401. Actuator origin/CSRF and team-only controls remain
unchanged. No client URL can select a server fetch target. There is no demo fallback
in the camera manager or streaming proxy. The separate legacy Upload Image flow
still has its existing labeled demo mode when unconfigured.

## Configuration and startup

From SmartPhset-AI, activate the existing venv and set private publishing values
in the terminal (never put real secrets in documentation or source):

```bash
source .venv/bin/activate
export SMARTPHSET_BACKEND_URL='http://localhost:9090'
export SMARTPHSET_AI_INGEST_KEY='YOUR_PRIVATE_INGEST_KEY'
python live_camera.py --source 'http://YOUR_CAMERA_LAN_IP:81/stream' --model-provider local --device cpu --serve --host 127.0.0.1 --port 8001
```

From SmartPhset-Prototype-Frontend, configure ignored `.env.local`:

```dotenv
SMARTPHSET_AI_CAMERA_ID=esp32-cam
SMARTPHSET_AI_LIVE_BASE_URL=http://127.0.0.1:8001
SMARTPHSET_API_BASE_URL=http://localhost:9090
```

Retain existing authentication and IoT settings, then run:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
```

For the existing Python laptop webcam, reuse the running worker, or start ONE
worker with `python live_camera.py --cam 0 --serve --host 127.0.0.1 --port 8001`.
Select **Laptop Webcam — AI Stream**, then Start. Do not run a second worker
against the same webcam. With one service on port 8001, only the camera it
currently serves is available: laptop mode requires `webcam-0`; ESP32 mode
requires `esp32-cam`. Choosing the other source shows an identity mismatch and
names the active known source; it never relabels video or restarts Python.

**This Device's Camera** uses `getUserMedia` on the viewing device, without AI.
Python/OpenCV may exclusively own the laptop webcam. Close competing capture
apps before browser preview, or select the Laptop AI stream to reuse Python's
annotated frames without requesting browser permission. A busy-device error keeps
Start and Retry available and offers a shortcut to select Laptop AI. Permission
denial, interrupted capture and offline Python have separate messages.
Shared Stop removes only this viewer's image and polling, not the Python worker
or another viewer. Shared source changes remount the panel and release the old
connection. Metadata uses camera-keyed query entries, reuses the global watcher
when it already watches the selected source, and hides different-source results.
Spring read authorization failures remain explicit; no credentials are bypassed.
The Python worker host must reach the camera LAN; browsers never need that address.
Do not forward camera ports 80/81 or publish the unauthenticated Python service.

## Local, phone and remote deployment

Local browser preview works on localhost with permission, independent of Python
or Spring. Shared annotated video requires reachable Python, matching camera ID,
and a signed-in account/allowed guest session. Saved detection metadata/history
also require successful Spring read access. These are implemented paths, not
claims of hardware or live deployment verification.

Phone camera access requires a trusted HTTPS origin; plain HTTP at the laptop's
LAN IP is not a secure context. `127.0.0.1` on a phone means the phone. Serve Next
through an existing trusted HTTPS development endpoint/reverse proxy reachable
by both devices, preserving session cookies and streaming without buffering. Do
not disable browser security or publicly expose the raw camera to test phones.

A hosted Next server cannot access the AI computer through its own 127.0.0.1.
Before remote deployment, use an outbound connection from the AI computer to a
private authenticated relay/tunnel. Protect relay access with mTLS or a service
credential enforced by the relay; keep the Python listener on loopback. Restrict
relay paths to health/MJPEG, disable response buffering, configure stream timeouts
and concurrency limits, and authenticate every viewer at Next. No relay or live
AWS configuration has been created or changed in this MVP.

### Spring detection reads / AWS deployment still required

Inspection found GET `/api/ai/detections/latest?camera=...` and GET
`/api/ai/detections?camera=...&limit=20` are permitAll in Spring and have no read
credential contract. The Next server authenticates browser sessions but currently
sends no AI service credential for these GETs. Nginx blocks public reads in the
existing deployment. A frontend cookie cannot authorize that upstream request.
Keep the block: a blocked read remains unavailable, independent of live video.

A subsequent backend/deployment change must add a dedicated read-only service
authentication contract (separate from ingestion), enforce it for both GET routes,
and forward a server-only credential from Next. Restrict camera access by server
registry/permissions and retain camera-filtered latest/history queries and response
validation. Then allow only that authenticated service path through Nginx, ideally
on private networking or mTLS. Test missing/invalid credentials, unauthorized source
IDs and ingestion regression before deployment. No backend, Nginx, ingestion or
AWS security policy was weakened here.

## Validation

Frontend repository:

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

AI repository:

```bash
.venv/bin/python -m unittest discover -s tests -v
git diff --check
```

Automated tests use mocked media devices for default/USB/front/rear constraints,
permission failures, independent owners, stop/switch, delayed permission cleanup,
and explicit disabled UI. Additional regressions cover busy-camera recovery, Laptop AI selection without browser capture, camera-keyed metadata and viewer-only stream cancellation. Proxy tests verify auth (including allowed guests),
source mismatch rejection, no demo on failure, streaming cancellation and fixed
server targets. Python tests cover one producer, latest-only consumers, slow
viewers, stale frames and peer survival after disconnect. Existing monitoring,
alerts and actuator tests remain part of the frontend suite. Mock tests do not
prove physical webcam, phone, ESP32, model-quality or AWS behavior.

Manual two-device check (same `team` account):

1. Open the trusted HTTPS app on laptop and phone, log in on both, open `/scan`.
2. With Python using `--cam 0`, laptop: Laptop Webcam — AI Stream → Start.
   Confirm annotated frames, `webcam-0` health/header and matching or explicitly
   unavailable metadata. Choose This Device's Camera: if the OS reports it busy,
   confirm Start/Retry remain available and the AI shortcut works. Stop Python
   locally before testing successful direct browser capture on that same webcam;
   test USB selection and permission denial/retry separately.
3. With the one Python worker serving `webcam-0`, phone: ESP32-CAM → Start must
   explain the source mismatch without showing mislabeled video. Laptop selection
   must remain unchanged. When intentionally running Python with the ESP32 source
   instead, verify the reverse: ESP32 works, Laptop AI reports mismatch.
4. Change the phone to local; test front/rear Switch Camera and actual labels.
   Laptop selection must remain unchanged. Verify no frame-upload requests in
   browser network tools. Refresh: preference remains, preview waits for Start.
5. Select shared on both. Stop one, then close its tab; the other must keep
   receiving frames. Disconnect camera/AI/network and verify clear offline states.
6. Switch to Disabled, Upload Image, or logout and verify local capture/streams
   close. Verify guest viewing and disabled guest actuator controls without sending
   commands to physical loads.

## Later phases

Additional shared cameras need a server-owned allowlisted registry mapping opaque
source IDs to private worker origins and permissions. Run exactly one producer
per physical source (separate Python processes/ports are simplest), add a stable
camera-ID CLI/config option to Python, and carry the selected registered ID through
health, stream, query cache, latest/history and alerts. Never accept arbitrary URLs
from a viewer or change the physical source when another viewer selects it.

Browser AI scan is deferred. Add explicit consent and a server-issued analysis
session, authenticated same-origin POSTs with CSRF protection, rate limits (for
example 1 frame/second), strict decoded resolution and byte limits (for example
1280×720 and 512 KiB), bounded single-flight inference and a short timeout. Keep
results scoped to the authorized analysis session and source, avoid raw storage,
and abort transmission immediately on Stop/logout/source switch. Service keys stay
server-only. WebRTC broadcasting and remotely sharing personal cameras are also
separate future work; this implementation provides personal local preview and the active Python laptop/ESP32 AI feed.

## Earlier implementation validation record (historical, 2026-10-28)

- `npm test`: passed all six test files, including existing actuator/monitoring
  regression coverage and new camera tests.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed.
- `npm run build`: failed in this restricted environment because Turbopack's
  CSS helper could not bind a port (`Operation not permitted`).
- `npm run build -- --webpack`: passed on the production-readiness rerun, including
  TypeScript, page generation, tracing and standalone output. Earlier fallback
  restrictions are superseded by this result. Runtime/browser verification remains
  blocked by loopback listen EPERM; see production-validation.md.
- Python unittest discovery: 93 tests run, 92 passed, one opt-in Spring/PostgreSQL
  integration test skipped; no failures.
- `git diff --check`: passed in both modified repositories.
- No physical camera, Android/iPhone browser, AWS endpoint, MQTT command or live
  relay test was performed. No firmware/backend/live infrastructure was changed,
  and no changes were committed or pushed. Existing untracked frontend CLAUDE.md
  was left untouched.

## Laptop AI and webcam-conflict validation (latest)

This update keeps the existing manager and Python worker. It does not add a capture
process or change AWS, firmware, IoT commands or global grow-room camera settings.

- `npm run test`: all 8 files pass; direct execution also passes all **105 cases**.
- New coverage: busy webcam → Retry → successful local capture; local → Laptop AI
  releases tracks; Laptop AI Start/Stop never calls getUserMedia; per-tab preference
  restoration and peer independence; authenticated allowlisted source requests;
  both health and MJPEG camera identity checks in both source directions; metadata
  routing/cache isolation and mismatched-response rejection; viewer cancellation
  leaves a peer stream readable; matching global metadata polling is reused.
- `npm run lint`: passes with zero warnings.
- `npm run typecheck`: passes, including a rerun after build attempts.
- `npm run build`: fails because Turbopack cannot bind its CSS helper socket
  (`Operation not permitted`), not a demonstrated source compilation error.
- `npm run build -- --webpack`: fails because the restricted TypeScript child
  process produces unusable `--showConfig` output. The capability probe reports
  `EPERM` and empty child stdout. Historical successful builds above do not
  establish acceptance of this updated source.
- Live `127.0.0.1:8001/health` is unreachable from this sandbox, so actual webcam,
  browser MJPEG rendering and hardware switching remain unverified. Hook/media
  and stream tests use isolated fixtures, not a real browser or physical webcam.

On the normal local host, reuse `live_camera.py --cam 0 --serve --port 8001`,
select Laptop Webcam — AI Stream and press Start. Check `/health` says `webcam-0`
and verify moving annotated frames. Stop one viewer while another remains open.
While Python owns the webcam, confirm direct browser mode gives an actionable
busy error where the OS enforces exclusive access; switch to AI instead, or stop
Python before retrying browser-only capture. With the worker serving ESP32 instead,
verify the ESP32 selection works and Laptop AI shows the active-source mismatch.
Do not start duplicate workers or send actuator commands as part of this check.
