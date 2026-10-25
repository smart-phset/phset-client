# SmartPhset web app

Next.js grow-room monitoring and AI Scan interface for SmartPhset.

## Role in SmartPhset

Browser → Next.js server → [Spring REST](https://github.com/smart-phset/phset-api)
→ PostgreSQL / MQTT → [ESP32](https://github.com/smart-phset/smart-things).
The camera firmware lives in [web-cam](https://github.com/smart-phset/web-cam),
separate from the regular ESP32 MQTT firmware. For live video: camera → [Python/OpenCV/YOLO](https://github.com/smart-phset/phset-ai/tree/feat/live-camera)
→ annotated MJPEG → Next.js → browser. AI metadata/history is stored in Spring.

Overview `/` and `/climate` show real grow-room readings and fan/light/pump controls;
`/history` shows persisted detections. No soil sensor is installed: floating GPIO34
values are not valid soil moisture. Some other pages retain labeled prototype data.
`/scan` has **Live Detection** and **Upload Image** tabs. Upload uses the separate
legacy bridge; an unconfigured upload URL produces labeled demo results.

## Requirements

Linux: Git, Node.js and npm, Bash. Windows: Git for Windows, Node.js with npm,
PowerShell. Native Windows works; WSL is optional. For the whole system also install
Docker Desktop, JDK 25, Python 3.11 (with the `py` launcher), and Arduino CLI as
specified in the other repositories.

`package.json` pins Next.js **16.3.8**, React **19.2.8** and uses Tailwind 3 and
TypeScript 5. It has no application-level Node engine pin; installed Next requires
Node **>=20.9.0**. The inspected developer environment uses Node **26.12.0** and
npm **12.2.1**. Use `npm ci` with the committed package-lock.json.

## Clone

```text
git clone https://github.com/smart-phset/phset-client.git
cd phset-client
git switch feat/grow-room-monitoring
```

This feature branch contains the current monitoring/live UI. Do not assume main
contains it. Authenticate Git for Windows with your GitHub account when prompted;
you need access to the smart-phset organization repositories.

## Configuration

Copy `.env.example` to ignored `.env.local`; replace `YOUR_*` values privately.
Next loads it automatically. Restart Next after changes. Every value below is
server-side: **never use NEXT_PUBLIC_ for these keys or internal service URLs**.
Commit `.env.example` only, never `.env.local`.

| Variable | Purpose / example | Secret? |
|---|---|---|
| SMARTPHSET_API_BASE_URL | Spring origin, `http://localhost:9090` | No |
| SMARTPHSET_IOT_API_KEY | Must equal Spring IOT_API_KEY, `YOUR_PRIVATE_IOT_KEY` | Yes |
| SMARTPHSET_DEVICE_ID | Match firmware DEVICE_ID and Spring allowlist, `grow-room-1` | No |
| SMARTPHSET_AI_CAMERA_ID | Overview/history camera: `webcam-0` or `esp32-cam` | No |
| SMARTPHSET_AI_LIVE_BASE_URL | Python live origin, `http://127.0.0.1:8001`; server-only | No |
| AUTH_USER | Team login name, `team` | No |
| AUTH_PASSWORD | Team password, `YOUR_TEAM_PASSWORD`; blank disables accounts | Yes |
| AUTH_SECRET | Random cookie signing secret, `YOUR_PRIVATE_AUTH_SECRET` | Yes |
| ALLOW_GUEST | `true` permits read-only guests; `false` disables guest entry | No |
| BACKEND_URL | Optional photo bridge origin, `http://127.0.0.1:8000`; blank = demo upload | No |
| BACKEND_MODE | `bridge` for bridge.py; `api` only for the legacy Node API contract | No |
| API_KEY | Match Python BRIDGE_API_KEY for real photo uploads | Yes |

Use separate random auth and bridge secrets; the backend README includes Bash and
PowerShell key generation. Guests can view monitoring/live streams but cannot
operate actuators. Configure AUTH_PASSWORD and AUTH_SECRET for team controls.
AUTH_SECRET otherwise falls back to AUTH_PASSWORD; set it explicitly.

**Current limitation:** `/api/ai/live/detection` explicitly requests `webcam-0`.
An ESP32-CAM stream can display live, but that panel's metadata can be missing or
belong to the webcam. SMARTPHSET_AI_CAMERA_ID changes Overview/history, not this
route. For ESP32 use Overview/history or Spring's `?camera=esp32-cam` endpoint to
verify its detections. Do not interpret old webcam results as ESP32 results.

Loopback refers to the machine running Next.js. A remote hosted Next.js instance
cannot reach your laptop via 127.0.0.1. This guide runs everything locally.

## Linux setup

```bash
npm ci
cp .env.example .env.local
# Edit .env.local privately before starting.
npm run dev -- --hostname 127.0.0.1 --port 3100
```

## Windows setup

```powershell
npm ci
Copy-Item .env.example .env.local
notepad .env.local
npm run dev -- --hostname 127.0.0.1 --port 3100
```

Copy only once; do not overwrite an existing configured .env.local. If PowerShell
blocks npm.ps1, use `npm.cmd` with the same arguments instead of weakening global
execution policy.

## Running

Normal team command in either shell:

```text
npm run dev -- --hostname 127.0.0.1 --port 3100
```

`npm run dev` without options defaults to port 3000. Team examples use 3100.
Open http://127.0.0.1:3100, sign in (or continue as a guest), then open `/scan`.
After login, inspect http://127.0.0.1:3100/api/ai/live/health and
http://127.0.0.1:3100/api/ai/live/stream in the same browser. Unauthenticated API
requests return 401. Health reports Python status; stream is a continuous response.

For real Upload Image, set BACKEND_MODE=bridge, BACKEND_URL=http://127.0.0.1:8000
and API_KEY matching BRIDGE_API_KEY. Start `python bridge.py --host 127.0.0.1 --port 8000`
in a separate activated AI terminal. This service does not replace the live
service on 8001 and uploaded-image results do not automatically enter Spring live
history. Do not point BACKEND_MODE=api at Spring: it refers to an older Node contract.

## Start SmartPhset from a fresh computer/reboot

One time: install tools, clone the five repositories as siblings in this order,
using these commands in **either Bash or PowerShell**:

```text
git clone https://github.com/smart-phset/phset-api.git
git clone https://github.com/smart-phset/phset-client.git
git clone https://github.com/smart-phset/phset-ai.git
git clone https://github.com/smart-phset/smart-things.git
git clone https://github.com/smart-phset/web-cam.git
git -C phset-api switch main
git -C phset-client switch feat/grow-room-monitoring
git -C phset-ai switch feat/live-camera
git -C smart-things switch main
git -C web-cam switch main
```

Follow each README's one-time dependency installation and private configuration
steps. Use separate terminals for Spring, AI, optional bridge, and Next.js.
Run commands from the corresponding clone's root, not from this frontend folder.

1. Each session: connect the laptop and boards to a reachable network (no client isolation).
2. Find the laptop LAN IP: Linux `ip route` or `ip -br addr`; PowerShell `ipconfig`.
   Select the IPv4 of the Wi-Fi/Ethernet adapter on the ESP32 network, not a Docker/VPN adapter.
3. Only if network/source changed: set regular ESP32 MQTT_HOST to that laptop IP,
   and Wi-Fi credentials privately; compile/upload firmware using the
   [regular ESP32 README](https://github.com/smart-phset/smart-things/blob/main/README.md).
   For ESP32-CAM, follow the separate [web-cam README](https://github.com/smart-phset/web-cam/blob/main/README.md)
   from the `web-cam` clone; it does not use MQTT_HOST. Flash the camera only when
   firmware/Wi-Fi configuration changes, not every reboot.
4. Each session: start Docker Engine or Docker Desktop; wait for `docker info` to work.
5. In phset-api: `docker compose up -d postgres mosquitto`; verify PostgreSQL readiness.
6. Once / on rotation: generate development keys as described in the API README;
   set matching backend/client IoT and backend/AI ingestion keys. Each session load
   the backend .env into the Spring terminal; Compose loading it alone is insufficient.
7. Start Spring: Linux `./gradlew bootRun`; PowerShell `.\gradlew.bat bootRun`.
8. Power the regular ESP32. If using ESP32-CAM, power it in normal boot mode too.
9. Verify MQTT state in the hardware guide and GET Spring's device state with the
   IoT header. Look for fresh timestamps. No installed soil sensor means no valid soil reading.
10. Activate the AI venv and set its backend URL and matching ingestion key in that terminal.
11. Choose **one** live source: laptop `--cam 0` or camera
    `--source "http://YOUR_ESP32_CAM_IP:81/stream"`. Start the full command from the
    AI README with `--serve --host 127.0.0.1 --port 8001`. Verify `/health` and
    `/stream.mjpg`. Set frontend camera ID accordingly, noting the live metadata limitation above.
12. In phset-client: start Next.js on port 3100. For real Upload Image also start
    the optional photo bridge on 8000 and configure its key/URL once.
13. Open monitoring `/`, `/climate`, `/history`, and `/scan`; sign in for controls.
14. Verify fresh reported state and moving live video; with safe load wiring,
    check commands and reported output changes. A command receipt is not physical
    load feedback. Pump should auto-off around 10 seconds. Inspect saved AI
    timestamps; GREY/unavailable never means healthy.

Dependency installation and config copies are **once**, or when dependencies/config
change. Docker services, Spring, Python and Next are **each session**. Stop app
terminals with Ctrl+C; `docker compose stop` in phset-api stops containers while
retaining data. Finish hardware testing with all loads OFF.

| Service | Port | Purpose |
|---|---|---|
| Spring | 9090 | REST and detection storage |
| PostgreSQL | 5432 | Database |
| Mosquitto | 1883 | MQTT |
| Mosquitto WS | 9001 | Configured WebSocket listener |
| Python bridge (optional) | 8000 | Upload Image |
| Python live | 8001 | Annotated MJPEG |
| Next.js (team command) | 3100 | Web UI |
| ESP32-CAM | 80 / 81 | Camera UI/capture / raw MJPEG |

## Testing

These commands work in Bash and PowerShell:

```text
npm run test
npm run lint
npm run typecheck
npm run build
git diff --check
```

For a production smoke test after build: `npm run start -- --hostname 127.0.0.1 --port 3100`
(stop the development server first). Manually test signed-in controls, guest
read-only access, service-offline states, live stream and a real uploaded image.

## Common problems

- Old UI: verify the feature branch, stop the old Node server, restart the team
  command, then hard refresh (Ctrl+Shift+R). Confirm the browser is on port 3100.
- Port occupied on Linux: `ss -ltnp 'sport = :3100'`; stop the owning terminal or
  `kill <PID>` after identifying it. On PowerShell:

  ```powershell
  Get-NetTCPConnection -LocalPort 3100 -State Listen
  # Replace 12345 with the OwningProcess shown above, after checking its identity.
  Get-Process -Id 12345
  Stop-Process -Id 12345
  ```

  `netstat -ano` is another way to inspect ports. Do not stop every Node process.
- Monitoring 503: check Spring, SMARTPHSET_API_BASE_URL and matching IoT keys.
  No fallback data is used for these pages. A 401 API response may mean no browser session.
- Live offline: check Python's http://127.0.0.1:8001/health first, then the signed-in
  Next proxy. Backend metadata and video are independent paths.
- Stale/incorrect AI metadata: check camera IDs, Python publishing key and Spring
  availability. See the explicit webcam-0 limitation for ESP32 live metadata above.
- Upload shows demo data: configure BACKEND_URL, bridge mode and matching bridge key;
  starting only live_camera.py does not enable real photo uploads.
- Turbopack build fails with permission errors binding helper ports in a restricted
  sandbox: rerun in a normal development terminal; do not claim that build passed.

More detail: [monitoring integration](docs/phase9-integration.md),
[UI guide](docs/user-guide.md), [legacy upload contract](docs/api-contract.md).

## Git workflow

Start with a clean worktree (`git status`). Update the branch named in Clone before
creating your own feature branch. These commands work in Bash and PowerShell:

```text
git pull --ff-only
git switch -c feat/my-change
# Edit and run the checks above.
git status
git add README.md
# Add other intended files explicitly; never add private configuration.
git diff --cached
git commit -m "Describe the change"
git push -u origin feat/my-change
```

Open a Pull Request against the team's agreed integration branch. Do not push
teammate changes directly to main. Never use `git push --force` unless the team
explicitly agrees and understands why. If pull refuses, inspect local changes and
coordinate; do not discard work with a hard reset.

## Security notes

Never commit `.env`, `.env.local`, private `config.h`, Wi-Fi passwords, API keys,
DB passwords or auth secrets. Commit only safe example files. Inspect
`git diff --cached` before each commit; do not force-add ignored files. If a secret
was committed, rotate it and coordinate cleanup; deleting it does not revoke it.
