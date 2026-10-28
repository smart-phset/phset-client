# SmartPhset · Web Dashboard

Authenticated Next.js dashboard for grow-room telemetry, fan/light/pump controls,
detection history and on-demand camera analysis. Uses Spring for durable IoT/AI
metadata and a separate Python YOLO service for inference. Repository remote:
`smart-phset/phset-client`; workspace directory: `SmartPhset-Prototype-Frontend`.

[API](https://github.com/smart-phset/phset-api) · [AI](https://github.com/smart-phset/phset-ai) · [Camera](https://github.com/smart-phset/web-cam) · [Sensors](https://github.com/smart-phset/smart-things)

## Features and architecture

Browser → signed Next session → server-side Spring/MQTT-backed APIs and Python
session proxy. Private service keys and raw shared-camera URLs never enter browser
configuration. No `NEXT_PUBLIC_` variable is needed for these services.

- IoT dashboard polls reported telemetry/state and displays freshness/errors.
- Equipment controls issue explicit ON/OFF commands; receipt is separate from reported state.
- Camera Manager discovers real browser `MediaDevices` inputs, front/rear phone choices,
  and Spring-registered shared sources such as ESP32-CAM.
- Start Camera opens a preview. **Start AI Detection** separately enables sampling/inference;
  Stop AI Detection clears analysis while retaining preview; Stop Camera releases tracks/session.
- Browser JPEG sampling supports 1/2/5 fps maximum, one in-flight request and SVG
  bounding boxes scaled to the frame. Preview alone does not upload browser frames.
- Shared MJPEG capture uses one Python worker per physical source; multiple viewers
  share capture/inference while session start/stop/results remain independent.

```text
src/app/(app)/                authenticated pages: dashboard, scan, settings, status
src/app/api/cameras/          signed session / registry / JPEG / MJPEG server proxy
src/app/api/ai/live/          legacy live compatibility routes
src/app/api/auth/             team sign-in/sign-out
src/components/CameraManager.tsx   preview and analysis UI
src/lib/browser-camera.ts     browser track ownership and device constraints
src/lib/camera-service.ts     Python/Spring server-side service authentication
src/lib/camera-analysis.ts    bounded frame pump
src/lib/auth.ts               signed expiring cookie sessions
src/lib/monitoring-proxy.ts   IoT server integration
 tests/                       node test suite
 scripts/ / deploy/ / docs/   checks, Docker entrypoint, Nginx example and guides
```

## Requirements and installation

Node.js **>=24.22.1** (`.nvmrc`: 24.22.1), npm, Git. Dependencies: Next.js 16.3.8,
React/React DOM 19.2.8, TypeScript 5, Redux Toolkit/react-redux, Tailwind CSS 3,
ESLint 9. Exact installs come from `package-lock.json`.

```bash
node --version
npm ci
cp .env.example .env.local
# Edit private values before starting.
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://localhost:3000`, sign in and select a camera on the dashboard.
Next automatically loads `.env.local`; restart after changing it. Use `npm ci`
for a fresh install; preserve existing work and do not copy teammate secrets.

## Server configuration

| Variable | Purpose |
|---|---|
| `AUTH_USER`, `AUTH_PASSWORD` | Shared team account; production requires strong non-placeholder password |
| `AUTH_SECRET` | HMAC session signing secret, at least 32 characters in production |
| `ALLOW_GUEST` | Default allows guests unless `false`; set false in production |
| `SMARTPHSET_API_BASE_URL` | Spring origin, local `http://127.0.0.1:9090` or deployed HTTPS API |
| `SMARTPHSET_IOT_API_KEY` | Match Spring `IOT_API_KEY` |
| `SMARTPHSET_DEVICE_ID` | Allowlisted MQTT device, example `grow-room-1` |
| `SMARTPHSET_AI_SERVICE_URL` | New persistent service base; default `http://127.0.0.1:8002` |
| `SMARTPHSET_AI_SERVICE_KEY` | New service secret, match Python; never expose to browser |
| `SMARTPHSET_CAMERA_API_KEY` | New Spring registry key, match API |
| `SMARTPHSET_AI_CAMERA_ID` | Legacy/shared metadata identity, example `esp32-cam` |
| `SMARTPHSET_AI_LIVE_BASE_URL` | Legacy live service/relay origin, default loopback :8001 |
| `SMARTPHSET_AI_LIVE_ENABLED` | Legacy live-route feature switch; not a gate for new `/api/cameras` routes |
| `SMARTPHSET_AI_RELAY_TOKEN` | Optional legacy relay bearer token; not the AI ingest key |
| `SMARTPHSET_AI_UPLOAD_ENABLED` | Image-upload switch; independent of persistent camera routes |
| `BACKEND_URL`, `BACKEND_MODE`, `API_KEY` | Optional photo bridge URL/mode (`bridge`) and `BRIDGE_API_KEY` counterpart; blank URL gives demo uploads |

Authentication uses signed HttpOnly SameSite=Lax cookies with server-checked
14-day expiry, a nonce and Secure over HTTPS. It is independent of Spring's JWT
stubs. Valid guest sessions can access camera routes when guests are enabled;
use `ALLOW_GUEST=false` for production. Mutation proxies enforce same-origin.

## Browser and shared-camera setup

For **browser-camera AI** on the developer computer:

1. Start Python `session_service.py` with a strong `SMARTPHSET_AI_SERVICE_KEY` and
   `SMARTPHSET_CAMERA_SOURCES='{}'`. Empty shared sources are valid.
2. Set the identical service key and loopback URL in Next's `.env.local`.
3. Start Next, sign in, choose a browser device, Start Camera, then Start AI Detection.

The browser preview can start without Python. Enabling AI creates a browser
session and uploads sampled JPEGs. Browser inference does not require Spring
registry success and currently does not publish browser detections to Spring.
Registry listing can fail while browser AI remains available.

For **registered shared cameras**, start the updated local Spring API with
`SMARTPHSET_CAMERA_REGISTRY=esp32-cam=Grow room` and a private registry key. Add
`{"esp32-cam":"http://CAMERA_LAN_IP:81/stream"}` to Python's private
`SMARTPHSET_CAMERA_SOURCES`. Next must use that API origin and matching registry key.
The exact same ID is required in both configurations. Spring returns IDs/labels
and `unknown` availability; Next combines that with Python `/sources` state.
The new registry is **not deployed on AWS** as of the release audit; current
Nginx denies those routes. See [dynamic inference](docs/dynamic-camera-inference.md).

Each tab/device creates a random Python session, with per-session revision and
result state. Owner identity derives from the signed Next login cookie; tabs in
one browser can share that login owner while retaining distinct session IDs.
Signing out closes that owner's sessions. Sessions expire after 60 seconds
without polling. Stopping one session does not stop another active shared viewer.
Browser/OS camera hardware may limit simultaneous access to the same device.

Use HTTPS for camera access from phones; `http://localhost` is a desktop secure
context exception, but `http://LAPTOP_LAN_IP` generally is not. The browser opens
its own phone camera; it cannot discover a laptop USB camera via MediaDevices.
Use a trusted HTTPS Next origin and proxy the worker privately. Do not expose raw
Python/camera ports or send registry keys in JS.

## Tests and production

```bash
npm test
npm run lint
npm run build -- --webpack
npm run typecheck
npm start -- --hostname 127.0.0.1 --port 3000
# Optional against an explicitly configured running frontend:
npm run test:production
git diff --check
```

`test:production` requires its documented runtime environment; see
[production deployment](docs/production-deployment.md) and
`scripts/production-smoke.mjs`. The ordinary Node suite uses mocks; it does not
verify physical cameras or loads. The release audit passed nine test files,
lint, typecheck and the webpack production build on the normal host.

`next.config.ts` enables standalone output. The existing multistage Dockerfile
uses Node 24.22.1, builds without credentials and runs as non-root with a health
check. `compose.frontend.yaml` is a separate frontend-only project, requiring
Compose >=2.30 for raw private env files; it publishes only `127.0.0.1:3100`,
sets restart/resource/logging restrictions and preserves backend/Mosquitto.
Set `SMARTPHSET_FRONTEND_IMAGE`, `SMARTPHSET_FRONTEND_ENV_FILE` and optionally
`SMARTPHSET_FRONTEND_PORT` as documented in the production guide. Keep production
secrets outside the checkout and out of build arguments/layers.

**Production limitation:** the current runtime validator and legacy feature flags
do not validate or disable the new persistent camera-service configuration.
Review private authenticated `SMARTPHSET_AI_SERVICE_URL` connectivity and route
access before enabling new camera AI. AWS Next cannot reach the developer
laptop's `127.0.0.1:8002`; container loopback is also separate from the host.
A secure private worker deployment or authenticated private relay is required;
none is provisioned by this documentation task. Legacy live and upload features
remain disabled in the production example until their separate relay is accepted.

## Troubleshooting

- 401: sign in again for expired cookies; then distinguish worker, registry, IoT and upload keys.
- 404 shared source: compare exact Spring/Python IDs; old AWS JAR lacks the registry. Expired/wrong-owner sessions also return 404.
- 403 registry on AWS: Nginx deliberately blocks unmatched routes; an image update alone cannot fix this.
- Camera busy: close meeting apps/legacy OpenCV capture. Use the shared worker source if Python owns the USB camera.
- Permission denied: browser/OS settings, trusted HTTPS on phones, correct selected device.
- Worker unavailable/503: start `session_service.py`, verify Next's server-side URL/key and model loading.
- 429: lower sampling/viewer load; Python serializes inference with no waiting queue.
- Missing registry: configure matching API key and updated Spring origin. Browser-only inference can still work.
- Stale history: browser sessions do not publish to Spring; shared publishing requires ingest URL/key and permitted reads.
- Build subprocess errors in restricted environments: rerun on the normal host; do not weaken auth or change source to hide an environment failure.

See [camera manager](docs/camera-manager.md), [developer guide](docs/developer-guide.md),
[production acceptance](docs/production-acceptance.md) and the workspace system
README when using all five checkouts together. Some older documents describe
legacy :8001 behavior; this README and the dynamic-camera guide describe :8002.
