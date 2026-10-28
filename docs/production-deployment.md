# Frontend production preparation — approval required before deployment

Status: **deployment is blocked until build and functional acceptance pass**.
These files prepare the frontend only. They do not modify AWS, backend/Mosquitto
containers, existing Docker networks, DNS, firewall rules or installed Nginx.

## Inspected baseline and changes

Frontend branch: `feat/grow-room-monitoring`; camera work was already uncommitted.
The existing untracked `CLAUDE.md` was left untouched. Next stays at 16.3.8 with
the committed dependency lock. Node 24.22.1 LTS is selected in `.nvmrc` and the
Dockerfile; local commands in this environment ran on Node 26.12.1 / npm 12.2.1.
Node 24 container compatibility still needs an actual image build/test.

New deployment artifacts:

- `Dockerfile`: dependency, build/validation and standalone runtime stages;
  non-root UID/GID 1001, explicit runtime health check and SIGTERM.
- `.dockerignore`: excludes environment files, credentials, `.git`, host
  `node_modules`, `.next`, logs and local tooling from the build context.
- `compose.frontend.yaml`: independent frontend project and bridge network,
  host-loopback binding, resource/log limits, init, restart and grace period.
- `.env.production.example`: server-only runtime configuration; all AI media
  access disabled until a separate relay is accepted.
- `deploy/nginx/phset.ratanak.me.conf.example`: reviewed-install example only.
- `scripts/validate-runtime-env.mjs`, `container-healthcheck.mjs`,
  `production-smoke.mjs`, and `deploy/docker-entrypoint.sh`.
- `/api/healthz`: public process liveness, no upstreams/config/secrets. Existing
  authenticated `/api/health` remains a legacy photo-service diagnostic.

Next now emits standalone output and omits X-Powered-By. Other security headers
are retained. The camera and photo proxy have explicit disable switches;
shared-video service credentials are forwarded only server-to-server over HTTPS.
Actuator commands, device IDs, MQTT/API credentials and Origin checks are unchanged.

## Validation and root cause (2026-10-28)

See `docs/production-validation.md` for final results and outstanding gates.
Turbopack fails when its CSS helper tries to bind a port in this sandbox
(`EPERM`). On the latest rerun, `npm run build -- --webpack` **passed** compilation,
Next's TypeScript validation, all 14 static-generation tasks, build tracing and
standalone output. Docker now uses this verified Webpack command without changing
the default package build script or suppressing checks.

An earlier Webpack attempt failed with empty TypeScript child output; that failure
was not reproduced by the complete build on this rerun. The diagnostic script
still reports restricted loopback/spawn operations. It is a capability probe,
not evidence that the now-successful Webpack build failed. No source build error
required a feature removal or security change. Local verification uses Node 26;
the Node 24 container build remains pending.

Run build/typecheck sequentially; never run two builds against the same `.next`
directory. Do not ignore build type errors or patch dependencies to bypass the sandbox.

Requested production start was attempted exactly:

```bash
npm run start -- --hostname 127.0.0.1 --port 3100
```

It failed with `listen EPERM` on 127.0.0.1:3100. Thus no HTTP/browser production
acceptance can be claimed from this environment. Docker daemon access is denied;
Compose schema checks do not prove the image builds or runs. Nginx is not installed
here, so the example still needs syntax/TLS verification on an isolated review host.

## Build and local production procedure

Use a normal developer/CI machine with Node 24.22.1, network access to npm/registry,
and enough disk/RAM. Use `nvm use` if nvm is installed. Never run these commands in
a checkout with another active build or development process using `.next`.

```bash
npm ci
npm run test
npm run lint
# Verified production bundler for this candidate (also used by Docker):
npm run build -- --webpack
# Optional Turbopack comparison; diagnose helper socket EPERM if restricted:
# npm run build
npm run typecheck
git diff --check
```

A failed build is a release gate. Do not start a leftover `.next` tree from a
previous release and count that as testing the current source. Preserve failed
logs; clean generated build output only after stopping processes that own it.

For the requested non-container production check, use an ignored `.env.local`
with the existing private auth and IoT values, and start:

```bash
SMARTPHSET_AI_LIVE_ENABLED=false SMARTPHSET_AI_UPLOAD_ENABLED=false \
  npm run start -- --hostname 127.0.0.1 --port 3100
```

Next's standalone output is intended to run as `node server.js` in the container;
`next start` may warn about standalone mode. The required runtime/image acceptance
must therefore also run against the standalone container below. Do not change the
start script to hide a failure.

In another terminal, load a private env file into the smoke process without
sourcing secrets as shell code or putting passwords in CLI arguments:

```bash
SMOKE_ENV_FILE=/ABSOLUTE/PRIVATE/frontend.env node scripts/production-smoke.mjs
```

The smoke loader reads the same literal key=value format as the Compose raw file
without shell evaluation or variable interpolation; values such as `$` and `#`
remain intact. Do not use quotes around values in that file. Existing process env
values take precedence. The smoke script signs in twice to the same account, checks pages/API auth, cookie
flags, redirect safety, guest policy, real monitoring GETs, disabled media and
camera-source metadata. Its command tests always use the INVALID actuator
`__smoke_invalid__`: it cannot target fan/light/pump even if a role/Origin guard
breaks. It never posts a valid actuator command or a real photo. Defaults require
working IoT reads. `SMOKE_REQUIRE_IOT=false` is only an explicit limited offline
mode, not an IoT acceptance pass. `SMOKE_REQUIRE_AI_READS=true` makes saved AI
reads mandatory once authenticated backend reads are deployed. The smoke script
does not prove camera permission/MediaStream cleanup or independent browser state.
It requires AI enable/disable settings matching the server's private runtime file.

For approved HTTPS staging only (this is NOT run automatically):

```bash
SMOKE_BASE_URL=https://YOUR_APPROVED_STAGING_DOMAIN \
SMOKE_ALLOW_REMOTE_READS=true \
  SMOKE_ENV_FILE=/ABSOLUTE/PRIVATE/frontend.env node scripts/production-smoke.mjs
```

## Runtime configuration and secrets

On the chosen deployment host, AFTER approval, place runtime files outside the
checkout/image, for example `/etc/smartphset/frontend/releases/RELEASE/frontend.env`.
Use a directory readable only by the deployment administrator, and file mode 600.
Copy `.env.production.example` there, replace all placeholders privately, and
retain the previous runtime file for rollback. Generate AUTH_SECRET with a secure
random generator (for example `openssl rand -hex 32`) and store the result only in
the private file. AUTH_PASSWORD must be unique and strong; the local development value is short
and matches a public identifier, so it must not be reused. The startup validator
rejects its length. Keep the established backend IoT
key rather than rotating it as part of a frontend release.

Compose >=2.30 is required for `env_file.format: raw`. Use unquoted literal values;
`$` is preserved. Do not `source` the file. `docker compose --env-file` controls
Compose interpolation; the application's `env_file` is separate. Our commands
pass image/path/port through shell variables and read the application secrets
only through `env_file`. Do not paste rendered Compose config, `docker inspect`
environment output, login responses, or cookies into tickets/logs. `config --quiet`
validates structure without printing secrets. Docker administrators can read
container environment variables; runtime env files are not a hardware secret store.

Container startup rejects missing/placeholder credentials, short auth secrets or
passwords, malformed IDs, non-HTTPS upstreams, ambiguous flags and enabled media
without its required HTTPS relay credentials. Nothing is injected as a secret
build ARG or `NEXT_PUBLIC_*`. Do not copy `.env.local` into a CI build context.

## Build and test the image (normal local/CI host)

```bash
# Choose a unique immutable release tag for the reviewed source AND uncommitted
# changes if building a local candidate. Do not label dirty work as a Git commit.
export SMARTPHSET_FRONTEND_IMAGE=smartphset-frontend:RELEASE_CANDIDATE
export SMARTPHSET_FRONTEND_ENV_FILE=/ABSOLUTE/PRIVATE/frontend.env
export SMARTPHSET_FRONTEND_PORT=3100

docker build --pull -t "$SMARTPHSET_FRONTEND_IMAGE" .
docker compose -f compose.frontend.yaml config --quiet
docker compose -f compose.frontend.yaml up -d --no-deps --wait --wait-timeout 90 frontend
docker compose -f compose.frontend.yaml ps
curl --fail --silent --show-error http://127.0.0.1:3100/api/healthz
SMOKE_ENV_FILE="$SMARTPHSET_FRONTEND_ENV_FILE" node scripts/production-smoke.mjs
```

Do not run this while another server owns port 3100. For an isolated candidate,
set port 3101 and `SMOKE_BASE_URL=http://127.0.0.1:3101`. Do not point a local test
at AWS commands; the smoke script performs no valid command writes. IoT GETs may
reach the configured AWS API only when the operator deliberately runs this test.

Record image ID/digest, source revision/dirty patch, Node/Next versions, build log,
test report, private configuration version (not its contents), and image scan
result. Pin the Node base image digest after registry verification; the patch tag
in the Dockerfile is explicit but tags alone are not immutable. Build for the
actual EC2 architecture; no EC2 architecture has been assumed or inspected here.
Build off-instance when possible so compilation does not starve backend/MQTT.
Scan dependencies/base image and review findings before release. No vulnerability
scan or registry pull succeeded in this restricted environment.

Verify runtime behavior in isolation:

1. `docker compose ... exec -T frontend id` must report UID/GID 1001.
2. Health is 200 while Python is off; unauthenticated monitoring/video remain 401.
3. Confirm host binding is 127.0.0.1, and port 3100 is unreachable externally.
4. Check representative static assets, sign-in, monitoring, `/scan` and Settings.
5. Stop with `docker compose -f compose.frontend.yaml stop -t 30 frontend`;
   verify a prompt graceful exit. Active long-lived video requests may need the
   full grace period. Then start it and retest; SIGKILL/OOM is not a graceful pass.
6. Restart the candidate container, verify runtime credentials persist and browser
   preferences remain local. No Docker volume should contain raw camera media.

Unhealthy containers do not automatically restart just because health is failing;
`unless-stopped` restarts exited processes. Monitor health externally and alert
rather than looping restarts on an upstream outage. Liveness checks deliberately
do not restart a healthy frontend because the laptop/API is offline.

## HTTPS staging, laptop and phone acceptance

Use a separately approved trusted HTTPS staging origin through the same proxy
settings as production. Plain `http://LAPTOP_LAN_IP:3100` cannot access phone
cameras; localhost on a phone is the phone itself. Do not disable browser TLS or
camera-security checks. An operator must provision DNS/TLS through the existing
approved process; this task made no DNS or certificate changes.

Complete `docs/production-acceptance.md`, recording device/browser versions and
actual results. Repeat same-account isolation in separate browser profiles and
on laptop + phone. HTTP smoke tests alone cannot establish browser state isolation.

## AWS EC2 release steps — AFTER explicit approval and all required gates

These are operator instructions, not actions already performed. Host Nginx is
assumed. If existing Nginx runs in Docker, 127.0.0.1 is that container; redesign
that connection explicitly instead of joining/changing existing networks or
exposing port 3100 publicly. This Compose project creates only its own isolated
bridge and does not declare backend/MQTT services or external networks.

1. Record current frontend image/config/upstream, API/MQTT container identities,
   monitoring baseline and available CPU/RAM/disk. Do not stop backend or broker.
2. Build and accept the image elsewhere; transfer it through the approved registry
   or `docker save`/`docker load` workflow. Pin the exact digest/immutable tag and
   record rollback artifacts. Do not push an image or commit without approval.
   Compose has `pull_policy: never`: explicitly load/pull the approved artifact
   first, not an accidental `latest` image at startup.
3. Install the private runtime file and permissions outside the checkout. Keep
   AI_LIVE_ENABLED and AI_UPLOAD_ENABLED false. Preserve AUTH_SECRET between
   frontend versions unless intentionally invalidating all sessions.
4. Inspect the existing Nginx ingress topology and free port. Set
   SMARTPHSET_FRONTEND_IMAGE, SMARTPHSET_FRONTEND_ENV_FILE and optionally
   SMARTPHSET_FRONTEND_PORT, then run `config --quiet` and start ONLY `frontend`
   with the `up --no-deps --wait` command above. Do not use another stack's
   Compose file or run global Docker prune/down commands.
5. Run the local HTTP smoke checks on EC2, verify image health/user/log/resource
   behavior, then complete approved HTTPS staging and device acceptance.
6. Review the Nginx example against the installed version/modules. Back up any
   previous frontend vhost, review `nginx -t`, obtain a valid certificate using
   the approved ACME process and validate renewal. Its path is an example; do
   not reference missing certificate files. API/MQTT vhosts stay unchanged.
7. Only after separate approval, install/reload the reviewed frontend vhost and
   make approved DNS/Cloudflare changes. Cloudflare must use strict origin TLS;
   bypass caches for authenticated HTML/API/video. Preserve Content-Type,
   X-SmartPhset-Camera-Id and Cache-Control on a future relay. Configure trusted
   real-IP handling separately if Cloudflare is in front; never trust an
   arbitrary incoming X-Forwarded-For for rate limits.
8. Verify HTTPS, certificate hostname/chain/renewal, Secure cookies, proxy Host/
   Origin handling, unauthenticated 401s, guest policy, no caching of private
   responses, and safe command rejection. No actuator retry/replay is permitted.
   Valid command/hardware testing requires separately authorized safe wiring.
9. Observe memory, CPU, reconnects, 4xx/5xx and backend/MQTT health. If acceptance
   fails, execute rollback; do not modify API security to make a test pass.

No frontend port needs to be added to EC2 security groups. Only existing approved
HTTPS ingress should reach Nginx. Cloudflare setup, security groups, certificate
installation and live Nginx edits are outside this task's authorization.

## Rollback

Retain the prior image AND private runtime file, Compose file, release metadata,
and frontend Nginx vhost. If the prior release predates `/api/healthz` or has a
different startup contract, use its retained Compose/health configuration rather
than applying this new service definition to an incompatible old image. Do not delete old artifacts during the observation window.

For an in-place release using a previous compatible standalone image, set
variables to the PREVIOUS reviewed values:

```bash
export SMARTPHSET_FRONTEND_IMAGE=smartphset-frontend:PREVIOUS_RELEASE
export SMARTPHSET_FRONTEND_ENV_FILE=/ABSOLUTE/PRIVATE/previous-frontend.env
export SMARTPHSET_FRONTEND_PORT=3100
docker compose -f compose.frontend.yaml config --quiet
docker compose -f compose.frontend.yaml up -d --no-deps --force-recreate --wait --wait-timeout 90 frontend
curl --fail --silent --show-error http://127.0.0.1:3100/api/healthz
SMOKE_ENV_FILE="$SMARTPHSET_FRONTEND_ENV_FILE" node scripts/production-smoke.mjs
```

If this is the first frontend install, there is no previous frontend release:
stop only `frontend`, and restore/remove only the newly installed frontend vhost
through the approved operator process. Never roll back by stopping the backend
or Mosquitto stack. Restore a prior frontend proxy upstream/config only if it
changed, test Nginx syntax and reload after approval. A frontend rollback performs
no database migrations. Configuration and image must be paired; rolling back only
the image can leave incompatible runtime flags/secrets. A rotated AUTH_SECRET
invalidates existing cookies, including those issued by the previous release.

This Compose service recreates one instance and has a short interruption; it does
not claim automatic rollback or zero downtime. Blue/green release on a second
loopback port with an approved upstream switch is an optional later procedure.

## Security and resource review

- Runtime secrets never enter build arguments/client JavaScript. The image context
  excludes env files; confirm this plus scan image layers and served bundles on
  the normal build host before release. Treat container-admin access as privileged.
- Loopback publishing, host Nginx TLS, overwritten forwarding headers, Secure/
  HttpOnly/SameSite cookies, login request limits and retained actuator Origin
  checks form the ingress boundary. Do not bypass Nginx or trust forwarding
  headers on a public application port. Production guests default to disabled.
- Auth uses a shared team password with signed server-side 14-day expiry and a
  random session nonce. Legacy tokens require a fresh sign-in. Logout is POST and
  clears the browser cookie; individual token revocation remains unavailable.
  A copied token can replay until expiry or AUTH_SECRET rotation. Password changes
  alone do not revoke tokens when AUTH_SECRET stays the same. Per-user accounts,
  revocation and app-level login rate limiting remain future security work.
- Public Origin checks use the Host preserved by Nginx and its overwritten
  X-Forwarded-Proto. Do not expose the Next port directly or accept untrusted
  forwarding headers. Actuator requests still require an Origin and team account.
- Photo analysis remains disabled pending decoded-media limits and real bridge
  acceptance. The frontend now enforces a 2 MiB encoded body limit, JPEG type,
  cross-site rejection, abort/deadline and redirect refusal. Unconfigured
  production uploads return 503 without demo results. See full-system-audit.md.
- Global AI alerts/history use the configured physical camera, independent of
  personal preview. Read failures/staleness must not look healthy. Existing
  backend/Nginx AI-read restrictions are retained; see the relay review.
- Non-root, no capabilities, no-new-privileges, read-only filesystem, bounded
  tmpfs/cache and 30 MiB rotating logs reduce container write/privilege exposure.
  Default budgets are 1 CPU, 768 MiB RAM, 512 MiB JS heap and 128 processes.
  These are starting limits, not measured capacity. Reserve EC2 headroom for
  Spring/MQTT and the OS; build elsewhere. Review OOMs before increasing limits.
- Stream proxy forwards chunks with backpressure and cancellation; Python stores
  one latest frame per source and skips frames for slow viewers. Nginx caps 4
  concurrent streams/IP and 16 total. Shared NATs may require reviewed limit
  tuning. Each viewer still costs a socket and network egress; there is no
  WebRTC/CDN media fan-out in this MVP. At an illustrative 30 KB JPEG × 5 fps,
  each viewer uses ~1.2 Mbit/s and ~0.54 GB/hour; actual measurements are required.
- Local webcam frames never leave the browser. No private media is intentionally
  persisted. Prototype pages/legacy demo uploads remain labeled; the production
  upload switch prevents fake AI results when the photo service is disabled.

## Official references reviewed

- [Next self-hosting and streaming](https://nextjs.org/docs/app/guides/self-hosting)
- [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Docker's Next.js container guide](https://docs.docker.com/guides/nextjs/)
- [Compose service/runtime options](https://docs.docker.com/reference/compose-file/services/)
- [Node 24.22.1 LTS security release](https://nodejs.org/en/blog/release/v24.22.1)
- [Nginx proxy behavior/timeouts](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Nginx request limits](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
