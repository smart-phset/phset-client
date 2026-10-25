# Phase 9 — real Spring monitoring

The Overview (`/`) and Climate (`/climate`) pages read the real grow-room state.
Scan History (`/history`) reads the latest 20 persisted AI detections. They never
fall back to mock readings, mock AI results, simulated actuators or fake graphs.
Other prototype pages are explicitly labelled previews. Their older Node/bridge
API draft in `api-contract.md` does not describe this Spring integration.

## API audit (current source, 2026-10-10)

Backend HEAD: `f66e05d`, main. ESP32 checkpoint: `bbf860d`, main, recorded upstream
matched at reconciliation. AI HEAD: `c2b8b00`, feat/live-camera. Frontend starting
HEAD: `951b222`, main. All four trees were clean at the start. No live fetch claim.

### IoT

Both routes require `X-SmartPhset-IoT-Key`, matching Spring's `IOT_API_KEY`.

- `GET /api/iot/devices/{device}/state`: current persisted record, HTTP 200.
- `POST /api/iot/devices/{device}/actuators/{actuator}`: body `{"on":true}` or
  `{"on":false}`; actuator is exactly `fan`, `light`, or `pump`.
- HTTP 202 response: `{"command_id":"<UUID>","on":true,"expires_at":<epoch seconds>}`.
  Expiry is generated for 10 seconds ahead. There is no actuator name/device ID
  in this receipt, and no physical acknowledgement or command-ID echo in state.

Current state response (all fields other than `device_id` can be null):

| Field | Type / meaning |
|---|---|
| `device_id` | string, backend allowlisted device ID |
| `temperature_c` | number or null, Celsius |
| `humidity_percent` | number or null, percent |
| `soil_moisture_percent` | number or null; presence does **not** prove validity |
| `telemetry_captured_at`, `telemetry_received_at` | ISO timestamp strings or null; device capture and backend receive respectively |
| `fan`, `light`, `pump` | booleans or null; ESP32-reported GPIO assignment |
| `state_captured_at`, `state_received_at` | ISO timestamp strings or null; separate from sensor timestamps |

No telemetry history, heartbeat, physical feedback or per-sensor availability
metadata exists. GET can keep returning the last persisted record while the broker
or ESP32 is disconnected. Broker health cannot be inferred from HTTP 200.

IoT status contract: missing/wrong key 401; unknown device or no report 404;
invalid actuator/body 400; missing configured IoT key 503; command broker failure
503. IoT uses `ResponseStatusException` and Spring Boot's servlet error rendering,
not the prototype `{error,message}` schema. Existing regression tests verify
preserved HTTP statuses and the rendered `status` field. Error messages are not
configured as a guaranteed wire contract. The Next proxy maps statuses to its own
safe `{error,message}` response without forwarding raw backend bodies/errors.
It cannot distinguish unknown-device vs never-reported 404, or missing backend
key vs broker-unavailable command 503, and explicitly describes those ambiguities.

### AI

Already supported; no backend extension required:

- `GET /api/ai/detections/latest?camera=<camera_id>`: one persisted response or
  404 `{"error":"detection_not_found","message":"No detection for camera"}`.
- `GET /api/ai/detections?camera=<camera_id>&limit=20`: ordered array, including an
  empty array. Limits 1–100; ordering is captured_at, created_at, UUID descending.
- `POST /api/ai/detections`: structured detection ingestion, **not** an image-upload
  API. First event 201; idempotent duplicate event 200. Configured `AI_INGEST_KEY`
  requires `X-SmartPhset-AI-Key`; missing/wrong configured key gives 401
  `{error:"unauthorized",message:"Invalid AI ingest key"}`. Blank key is existing
  open local-development ingestion behavior. The frontend does not ingest.
- Invalid AI requests/camera/limits return 400 `{error:"invalid_detection",message:...}`.

The full read DTO includes `id`, `event_id`, `camera_id`, `captured_at`, `created_at`,
`verdict`, `severity`, `message`, `n_contaminated`, `n_healthy`, `max_conf`,
`max_contaminated_conf`, `width`, `height`, `inference_ms`, and `boxes` (label, conf,
integer xyxy). The dashboard selects real verdict/severity/message, both confidence
summaries, counts, camera and timestamps. No image/file URL or model/version field
is returned. Unavailable/no-detection results remain GREY and are not healthy.
These are stored results; the latest result is not a camera heartbeat.

Network streams publish `camera_id=esp32-cam`; local camera 0 publishes `webcam-0`
(current `live_camera.py`). Configure the intended actual camera, not a synthetic
Phase 7 test camera. Empty/missing camera configuration is reported clearly.

### Authentication and CORS

Spring permits the narrow IoT/AI paths through its security chain, then IoT checks
the key in its controller. AI read routes are public; ingestion uses the optional
configured key. Unrelated routes require authentication. Servlet ERROR dispatch is
permitted; direct ordinary access to `/error` remains protected. Backend auth/JWT
classes are stubs; there is no usable Spring login/token flow to integrate.
No CORS bean/filter/`@CrossOrigin` is configured. Same-origin browser -> Next server
-> Spring needs no browser CORS change.

Next retains the existing signed HttpOnly team/guest session. Every monitoring
handler checks the session independently of the Next proxy gate. Guests may read;
actuation requires a named team session, exact same-origin `Origin`, JSON content
and a bounded body containing only `on:boolean`. The server chooses the device,
backend and camera; the browser cannot choose a forwarding URL. No command retries.
Server fetches have a five-second deadline, no-store caching and redirects rejected.
Raw upstream bodies, exception text and credentials are never relayed.

Server-only configuration:

```dotenv
SMARTPHSET_API_BASE_URL=http://localhost:9090
SMARTPHSET_IOT_API_KEY=
SMARTPHSET_DEVICE_ID=grow-room-1
SMARTPHSET_AI_CAMERA_ID=esp32-cam
AUTH_USER=team
AUTH_PASSWORD=
AUTH_SECRET=
ALLOW_GUEST=false
```

Fill secrets privately. The IoT key must match backend `IOT_API_KEY`. Do not use
`NEXT_PUBLIC_` for these secrets. Guests can optionally be enabled for read-only
monitoring. `monitoring-server.ts` imports `server-only`; only the server injects
the IoT header. The browser never talks to Mosquitto. Existing legacy `BACKEND_URL`,
`BACKEND_MODE`, `API_KEY` settings are not used by these pages.

## Freshness and commands

Polling runs about every five seconds **after each request cycle completes**;
slow cycles never overlap. Hidden tabs abort polling; visibility resumes polling.
State and AI failures are independent. Old retrieved data remains labelled as old
when a request fails; no simulation replaces it.

Device status takes the older of state capture/receive times: active up to 20s,
stale above 20s, offline above 60s. Missing/invalid times or clocks more than 5s in
the future are unavailable. The 20s threshold allows several missed 5s reports;
60s distinguishes a prolonged gap. Telemetry freshness is computed separately,
so recent actuator reports cannot make old sensor readings look fresh. Keep browser,
backend and device clocks synchronized. These are inferred statuses, not heartbeats.

The installation has **no soil sensor**. The proxy always masks the stored soil
percentage to null and returns `soil.available=false`; the card reads "Unavailable
— Sensor not installed". This explicit installation rule cannot be enabled with a
convenience environment flag. Validate hardware/calibration and introduce genuine
sensor-validity metadata before changing it. GPIO34 percentages remain invalid.

Actuator sequence: sending -> 202 accepted -> waiting -> newer ESP32 report matches
requested boolean -> reported-state confirmation. Confirmation requires captured
and received timestamps newer than the pre-command report, a receive time at/after
submission, and recent state. The MQTT state contract has no command ID, so this is
confirmation of observed GPIO state, not a correlated physical acknowledgement.
After 20s with no matching report, display unconfirmed; never resend automatically.
ON is disabled for stale/unavailable state and while waiting; OFF remains available
to signed-in team users except while their request is in flight. Each control has
at most one browser command request in flight.

Pump output still automatically turns OFF after approximately 10s in firmware;
the UI follows the next OFF report and never forces it back ON. GPIO27 relay
switching is physically verified. Actual pump/load, soil, fan/light and remaining
physical safety acceptance are not verified. Firmware/backend were not changed.

## Local stack and validation

Use Java 25 and the existing private database credentials. Do not assume any
previous service remains running. These commands do not upload firmware or send
actuator commands automatically.

Terminal 1 — containers (existing volumes retained):

```bash
cd /home/ratanak/smart-phset/api
docker compose up -d postgres mosquitto
docker compose ps
```

Terminal 2 — Spring:

```bash
cd /home/ratanak/smart-phset/api
export JAVA_HOME=/opt/android-studio/jbr
export PATH="$JAVA_HOME/bin:$PATH"
export DB_URL=jdbc:postgresql://localhost:5432/smartphset
export DB_USERNAME=smartphset
read -rsp 'Existing database password: ' DB_PASSWORD
export DB_PASSWORD
read -rsp 'Existing IoT API key: ' IOT_API_KEY
export IOT_API_KEY
export MQTT_ENABLED=true
export MQTT_BROKER_URL=tcp://localhost:1883
export MQTT_DEVICES=grow-room-1
./gradlew test --tests '*Iot*' --tests '*Mqtt*' --tests '*AiDetection*'
./gradlew bootRun
```

Use the actual DB username/URL if yours differ. Preserve any configured broker
credentials and AI ingest key privately in the environment. Spring does not
load Compose `.env` automatically. Do not recreate firmware config or expose keys.

Terminal 3 — frontend:

```bash
cd /home/ratanak/smart-phset/SmartPhset-Prototype-Frontend
[ -f .env.local ] || cp .env.example .env.local
# Edit .env.local privately using the server-only configuration above.
# Use the SAME IoT key as Spring; set a team password/signing secret for controls.
# Existing non-template .env.local must not be overwritten.
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

Use Node >=22.18 for the native TypeScript test runner (this session used 26.11.1).
Open **http://localhost:3000**, sign in as the configured team user, then Overview.
For a production server after a successful build, use `npm run start` instead.

The ESP32 must already run its verified firmware on the current Wi-Fi/broker LAN
configuration. Nothing here flashes or reconfigures it. For AI, use the existing
publisher/setup in `../SmartPhset-AI/docs/live-camera.md` with the same Spring URL
and matching camera ID; reads may show existing real stored results with no camera
process running. Do not fabricate new detections to populate an empty dashboard.

## Manual browser/hardware acceptance

- Verify device ID, actual DHT11 values and separate capture/receive timestamps.
- Verify Soil says sensor not installed, including browser network responses.
- Verify signed-out API calls fail and guest sessions cannot actuate.
- Issue one pump-output ON command through the UI. Observe sending, accepted,
  then ESP32 reported ON and eventual OFF around the firmware timeout. Compare
  with physical relay behavior. Do not infer actual water pump operation.
- Verify rejected/unavailable commands remain errors; never optimistic ON or retry.
- With safe conditions and no dependent loads, stopping board reports should cause
  stale then offline status while successful API reads keep the same old timestamps.
  Restore reporting and verify recovery. API failure should show unavailable.
- Inspect the configured camera's real latest/history data, or honest empty state.
- Check mobile layout, keyboard controls and no IoT secret in network/client assets.

Implementation tests use explicit fixtures with injected transport only, never
real broker/hardware writes. The user subsequently reported locked installation, lint, typecheck, tests and
production build PASS, along with real browser monitoring and frontend-to-relay
control acceptance. See `CODEX_WORK_LOG.md` for the acceptance record and deferred
hardware checks; actual pump/load operation remains unverified.

## Framework research

Reviewed official Next.js [server/client boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components),
[backend-for-frontend routes](https://nextjs.org/docs/app/guides/backend-for-frontend),
and [ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint)
on 2026-10-10. Keep pinned Next 16.3.8/React 19.2.8 and the existing Tailwind 3
system. Next 16 build does not replace lint; explicit ESLint/typecheck/test scripts
are added. New dev-only lint tools: ESLint 9.39.5 and typescript-eslint 8.70.0,
matching the available local tooling; existing dependency versions are preserved.

## Continuation acceptance — 2026-10-24

Frontend checkpoint edb5152 already contains the real dashboard. The continuation
changes fresh device wording to ONLINE and retains matching ESP32 reports that
arrive during command submission, with confirmation shown once HTTP202 returns.
A late matching report can also clear the 20s unconfirmed message. Neither path
resends commands or changes the current reported ON/OFF value. An old confirmation
message describes the last command, even when pump safety later reports OFF.

For the current changes, browser + ESP32 acceptance is pending. Historical Phase9
acceptance above does not certify this working diff. Repeat the manual checklist,
including normal-terminal npm run build. Sandbox standard build failed because
Turbopack cannot bind a port; webpack fallback also failed parsing --showConfig.
Start PostgreSQL first (`docker compose up -d postgres`), then Mosquitto
(`docker compose up -d mosquitto`), then Spring as above. Power the already-flashed
regular ESP32 after Spring is ready, then start Next.js and open the browser.
Do not flash/reconfigure firmware for this frontend change.
