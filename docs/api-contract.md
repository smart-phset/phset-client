# SmartPhset API contract (draft v0)

The agreement between the **frontend** (this repo, Hout) and the **backend** (Node.js REST API on the laptop,
the engineer). The engineer owns the backend and has the final say on details. Change this file when the API
changes, and tell the other person.

## How the website reaches the backend

- The backend runs on the laptop and is exposed through a **tunnel** (Cloudflare Tunnel or ngrok). The tunnel
  gives it a public HTTPS address.
  - It is needed because an HTTPS page cannot call a plain `http://` local-network address (mixed content).
- The website's **own server on Vercel forwards** each call to the tunnel and adds the API key. So:
  - The browser never sees the key or the tunnel address.
  - No CORS setup is needed on the backend.
- **Key header:** `Authorization: Bearer <API_KEY>` (to confirm with the engineer). A missing or wrong key gets
  401.
- **Vercel settings:** `BACKEND_URL` (tunnel address) and `API_KEY`.
  - When `BACKEND_URL` is empty, the website uses placeholder data with the shapes below.
- **Photos:** shrink in the browser to about 1280 px (JPEG quality ~0.8) before upload, because Vercel caps
  forwarded requests at 4.5 MB.

## Rooms

A farm has **several grow rooms**. Each room has its own controller (one ESP32), which is its `device` id:

```json
[{"id": "r1", "name": "Room 1", "device": "esp32-1", "bags": 1000},
 {"id": "r2", "name": "Room 2", "device": "esp32-2", "bags": 800},
 {"id": "r3", "name": "Room 3", "device": "esp32-3", "bags": 600}]
```

- Readings and device settings are **per device**, so per room.
- Every **scan** and **alert** carries the `room` id.
- The website currently has these three rooms built in (`src/lib/data.ts`). Later it will read them from
  `GET /rooms`.

## Endpoints (base: `<BACKEND_URL>/api`)

| Method and path | Used by | For |
|---|---|---|
| `GET /rooms` | Website | The farm's rooms (shape above) |
| `POST /telemetry` | ESP32 | Send a reading for its room; the reply can carry targets and overrides |
| `GET /readings/latest?device=esp32-1` | Website | Live numbers for one room (the website asks for each room) |
| `GET /readings?device=esp32-1&from=...&to=...` | Website | Chart history for one room |
| `POST /images?camera=phone-1&room=r1` | Website | Upload a photo (raw JPEG body) taken in that room; reply = AI result |
| `GET /images?limit=20&room=r1` | Website | Recent photos with results (room optional) |
| `GET /images/{id}/file` | Website | The photo itself |
| `GET /alerts?limit=50&room=r1` | Website | Alerts, newest first (room optional) |
| `GET /devices/{id}/settings`, `PUT /devices/{id}/settings` | Website | Targets, manual fan/mist override |
| `GET /health` | Both | Is each part alive |

## Shapes

**Latest reading:**
```json
{"device": "esp32-1", "time": "2026-10-10T14:02:30+07:00", "temp_c": 27.4, "rh": 88.2,
 "fan_on": true, "mist_on": false, "water_ok": true, "fault": "", "online": true, "co2_ppm": null}
```
`co2_ppm` is always `null`, because there is no CO2 sensor. Show "not measured".

**Photo result:**
```json
{"id": "b7c1", "room": "r1", "time": "2026-10-10T14:05:11+07:00", "camera": "phone-1",
 "verdict": "contamination_suspected", "level": "amber", "max_contaminated_conf": 0.62,
 "n_contaminated": 1, "n_healthy": 2, "width": 1280, "height": 960,
 "boxes": [{"label": "contaminated", "conf": 0.62, "xyxy": [135, 560, 803, 943]}],
 "file_url": "/api/images/b7c1/file"}
```

**`verdict` values:**
- `contamination_suspected`
- `no_contamination_seen`
- `no_detection` and `camera_error`: both mean **"could not check"**. Never show them as healthy.

**`level`** comes from `max_contaminated_conf`. Never use the highest confidence of all boxes, because that
includes healthy boxes.

| Level | When |
|---|---|
| `red` | 0.80 or higher: likely mould |
| `amber` | 0.40-0.79: please check |
| `green` | Bags seen, nothing flagged |
| `grey` | Could not check |

**Boxes** are in the photo's pixel coordinates. Draw them over the photo using `width` and `height`.

Optional extras on a photo result: `model_version` (for example `"yolov8n-2026-06-20"`) and `ms` (how long the
check took).

**Alert:**
```json
{"id": "a1", "room": "r2", "time": "2026-10-10T12:15:47+07:00", "kind": "mould", "level": "red",
 "title": "Likely mould on a bag", "detail": "AI scan, 91% confidence", "scan_id": "s3", "resolved_at": null}
```
`kind` is one of `mould`, `climate` or `device`.

**Device settings** (`GET` / `PUT /devices/{id}/settings`):
```json
{"rh_low": 85, "rh_high": 90, "temp_max": 30, "fan_override": "auto", "mist_override": "auto",
 "override_until": null}
```
- Overrides are `auto`, `on` or `off`.
- `on` and `off` last 10 minutes (`override_until`), then return to `auto`.

**Health** (`GET /health`): a list of
`{"name": "AI service", "status": "ready", "detail": "yolov8n, average 0.4 s"}`.

**Error:** `{"error": "short_code", "message": "plain words"}`, with status 400, 401, 404 or 503.

## The AI service (for reference)

On the laptop, `bridge.py` (Python) answers `POST http://127.0.0.1:8000/image` with a raw JPEG body. It returns
`verdict`, `max_contaminated_conf`, `n_contaminated`, `n_healthy`, `width`, `height` and `boxes`. The backend
calls it and adds `id`, `level`, `time` and `file_url`.

The code, the model and the full bridge API are in the
[SmartPhset-AI](https://github.com/menghoutishere-code/SmartPhset-AI) repo (`docs/bridge-api.md`).
