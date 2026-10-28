# Remote AI viewing: proposed authenticated relay

## What is implemented and what is unavailable

Browser-local preview needs only the authenticated HTTPS frontend and device
permission. It does not use the laptop AI process or upload frames. IoT monitoring
and existing actuator controls use the Spring API through Next's authenticated
server routes; packaging does not change those contracts.

Shared ESP32 AI works architecturally when Next can privately reach the updated
Python worker. The AWS container's 127.0.0.1 points to the container, not the laptop
or EC2 host. `host.docker.internal` would at most identify the Docker host when
configured; it still cannot identify the developer laptop. A public raw camera
URL/port-forward is not an acceptable fix. The runtime template therefore sets
SMARTPHSET_AI_LIVE_ENABLED=false and SMARTPHSET_AI_UPLOAD_ENABLED=false.

No relay, tunnel, VPN, new AWS process/security group, DNS record or certificate
was created. Remote shared video has NOT been verified and stays disabled. An
optional server-side bearer-credential adapter is implemented in live-server /
live-proxy for the proposed relay. It uses a dedicated server env value, HTTPS,
fixed paths and no redirects. It is not an authentication mechanism in Python.

## Proposed connection and trust boundaries

```text
ESP32-CAM --private LAN HTTP--> laptop Python YOLO
                                  |
                          bounded latest JPEG
                                  |
                         loopback-only :8001
                                  |
              outbound, mutually authenticated tunnel connector
                                  |
                   controlled HTTPS streaming relay
                     (private/restricted ingress)
                                  |
              TLS + dedicated service Bearer credential
                                  |
                     AWS Next standalone container
                                  |
                  authenticated viewer via Nginx HTTPS
```

Prefer an outbound connector/tunnel from the laptop to an operator-controlled
relay: it works without opening inbound home/router ports. Use mTLS or an
equivalent authenticated encrypted transport for connector registration and
renewable identities. Keep Python on loopback and constrain the connector to
that one configured local destination, not arbitrary TCP/URL forwarding. The
laptop must stay awake and on the camera LAN; sleeping/offline means unavailable.
For permanent operation, a supervised always-on LAN AI host is more reliable.

The relay terminates trusted HTTPS for Next and verifies a separate strong,
rotatable `Authorization: Bearer` service credential on BOTH `/health` and
`/stream.mjpg`. Restrict ingress to the frontend network/egress where feasible;
use private networking/VPN as a further boundary. Only fixed registered source
paths are supported. An upstream identity must never be accepted solely because
the caller supplied a camera ID or viewerSessionId. Preserve the worker camera
header and multipart boundary. Auth challenges must return an error, not an
interactive login page or redirect. Credentials never belong in URLs or logs.

This bearer contract is NOT automatically compatible with a vendor's service-token
scheme: an Access product requiring custom client-ID/secret headers would need a
reviewed server adapter and policy configuration. Do not make a tunnel endpoint
public just to avoid that integration. Tunnel trust, endpoint authorization and
viewer authentication are three separate boundaries.

A relay should maintain one upstream latest-frame feed per physical camera and
fan out with bounded latest-frame slots where possible. A simple per-viewer
reverse tunnel still preserves one Python inference worker, but multiplies laptop
uplink and relay egress. Measure both before promising viewer capacity. Cap global
and per-principal stream concurrency, socket/idle timeouts, and health request
rates; cancel downstream disconnects. The proposed frontend Nginx example has
initial per-IP/global viewer caps, not a claim of relay capacity.

The existing Python server is unauthenticated and defaults to loopback. Never
bind it to a public interface or reuse an unauthenticated tunnel. Never expose
ESP32-CAM ports 80/81 publicly, use a camera URL from request parameters, or send
backend ingestion/IoT keys as the relay credential. The connector authenticates
the AI host; Next's service credential authenticates Next; Next's cookie gates
the viewer. Browser-generated IDs are not authorization.

## Application configuration after approved relay acceptance

Keep these values server-only in the private runtime env file:

```dotenv
SMARTPHSET_AI_LIVE_ENABLED=true
SMARTPHSET_AI_CAMERA_ID=esp32-cam
SMARTPHSET_AI_LIVE_BASE_URL=https://YOUR_APPROVED_PRIVATE_RELAY_ORIGIN
SMARTPHSET_AI_RELAY_TOKEN=YOUR_DEDICATED_RELAY_SERVICE_TOKEN
SMARTPHSET_AI_UPLOAD_ENABLED=false
```

No raw camera target is sent to browser JavaScript. Next appends only `/health`
or `/stream.mjpg`, refuses redirects, sanitizes health output and checks source
identity. The existing publisher continues to write to Spring with its own
AI ingestion key; this relay has no need to receive that key. Keep photo analysis
disabled until its separate upload bounds/auth/timeout review is complete. Browser
camera AI sessions, WebRTC and remotely sharing personal cameras are future work.

## Saved metadata and history: separate deployment dependency

Current local source inspection: Spring has camera-filtered latest/history
contracts, and the controller/SecurityConfig permit GET without a dedicated
service-read credential. Existing deployment Nginx blocks public read access;
this task did not probe or modify live AWS policies. Next's monitoring proxy
requires a viewer session but currently has no upstream AI-read credential
contract. Do not remove Nginx restrictions, expose unauthenticated history or
send the ingestion key to browser JavaScript to make metadata appear.

A subsequent coordinated change needs dedicated read-only service auth for
GET `/api/ai/detections/latest?camera=...` and GET
`/api/ai/detections?camera=...&limit=20`, an appropriate source allowlist/permission
policy, Next server credential forwarding, and restricted Nginx/private ingress.
Keep the ingestion authentication unchanged. Test missing/wrong credentials,
source access, source-filtered ordering, staleness and ingestion regression before
AWS deployment. Video and saved metadata remain independent: a relay alone does
not unblock saved metadata/history, and metadata availability does not prove
live camera availability.

## Required relay acceptance before enabling

- Authenticated connector only, fixed loopback destination, no inbound LAN ports.
- Valid TLS chain/hostname and wrong/missing credential rejection on both paths.
- Verified `camera` / `X-SmartPhset-Camera-Id`, matching live metadata when reads
  are available, no redirect/login/demo bodies accepted as stream data.
- Two same-account devices, one producer, bounded memory, slow/disconnected viewer
  independence, idle timeout, reconnect and worker/laptop/network-offline errors.
- Explicit capacity, bandwidth/cost and laptop-availability measurements.
- Credential rotation/revocation and tunnel shutdown procedure.
- Separate approval for relay infrastructure/network/DNS changes. None has been
  approved or performed by this task.
