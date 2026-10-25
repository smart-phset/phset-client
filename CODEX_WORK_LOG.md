# SmartPhset frontend — Phase 9 work log

## Phase 9 real monitoring implementation — 2026-10-10

Status: Phase 9 local software and browser/relay-control acceptance PASSED, as
reported by the user after testing the locked dependency installation locally.
User authorized a new frontend commit and feature-branch push; no merge to main.

### Reconciliation / authorization

Read relevant Phase 7/8 logs, inspected current API/firmware/frontend source and
reconciled all four repositories before editing. Initial clean branches/HEADs:
- api/main f66e05dec227e5a2714efa701a01ccd0cd31e3c6
- smart-things/main bbf860d06b0855e3f3f6fc7bb4b5327fda48e62a
- SmartPhset-AI/feat/live-camera c2b8b0091d9c256c43cc51211c5ac1ad29923086
- frontend/main 951b222cc1272540375b07c9c31c55b7fbd488c2
Each matched the local upstream ref. No fresh remote fetch/verification claimed.
Confirmed smart-things/main contains the latest physical relay verification commit.
Frontend work is isolated on feat/grow-room-monitoring, following CONTRIBUTING.md.
User explicitly authorized beginning Phase 9, superseding historical no-Phase-9
instructions, and requires approval before new commits/pushes. Prior commits intact.

Verified hardware remains ESP32 Wi-Fi/MQTT/NTP/DHT11, reported state, GPIO27 output,
software pump timeout and physical relay ON/OFF switching. Actual water pump/load,
soil sensor/ADC/calibration/telemetry, physical fan/light and remaining physical
actuator safety acceptance stay deferred. No hardware actuation performed here.

### Audit / decisions

Current contracts and exact startup/acceptance commands: docs/phase9-integration.md.
Existing IoT current state and actuator API suffice; AI latest/history already
exist. No Spring, database, AI or firmware source changes are required or made.
IoT errors use Spring servlet error rendering; proxy safely maps HTTP statuses.
Unknown device/no report and missing backend key/broker failures cannot always be
separated from their status alone. No invented heartbeat, history, photo URL or data.

Retain Next App Router/design tokens/self-hosted fonts/English-Khmer translation
mechanism and existing team/guest sessions. New monitoring text uses t() and
currently falls back to English where Khmer entries do not exist; flag those
translations for native review before release. Server-only proxy injects the IoT
key; guests read only. Actuation checks Origin, JSON type, bounded body, exact actuator
and boolean. Server chooses device/base URL/camera; no browser MQTT, no secret in
NEXT_PUBLIC variables, no raw upstream errors, redirects or command retries.

Overview and Climate use real monitoring; history uses real persisted AI results.
Other prototype pages have a clear preview notice. Disable legacy simulation/API
polling and fake room/alert indicators on real pages. Remove two obsolete Next-lint
suppression comments in scan/setup to enable the project's new TypeScript linter.
No unrelated page redesign or legacy AI image-upload contract change.

State and telemetry freshness are independent (20s stale, 60s offline, 5s future
clock tolerance). Polling schedules after completion, pauses while hidden and
aborts on disposal. Submission/202/report confirmation are distinct; 20s confirmation
window, no automatic retry or pump re-ON. Soil is explicitly unavailable and stripped
from proxy responses until actual hardware validity is supported.

### Files / dependencies

Changed existing: .env.example, package.json/package-lock.json, tsconfig.json,
src/app/(app)/page.tsx, climate/page.tsx, history/page.tsx, layout.tsx,
scan/page.tsx and setup/page.tsx (obsolete lint comments only),
src/components/Shell.tsx, src/lib/store.tsx, README.md,
docs/api-contract.md, docs/developer-guide.md, docs/README.md.
New: monitoring API route handlers (state, detection, detections, actuator),
src/lib/monitoring.ts, monitoring-proxy.ts, monitoring-server.ts,
monitoring-poll.ts, src/components/monitoring/GrowRoomDashboard.tsx,
PrototypeNotice.tsx, tests/monitoring.test.mjs, eslint.config.mjs,
docs/phase9-integration.md and this log.

Pinned runtime Next 16.3.8 / React 19.2.8 / Tailwind 3 preserved; no pre-existing
lockfile dependency version changed. New dev-only ESLint 9.39.5 and
typescript-eslint 8.70.0. Lock metadata sourced from installed local packages and
validated by offline npm lock resolution and npm ci dry run; no fabricated integrity.
Official Next documentation researched 2026-10-10, linked in integration guide.

### Validation / limits

- Pre-change required relevant Gradle tests attempted: home cache read-only.
  Retried Gradle 9.7.1 using Java 25 JBR and writable copied /tmp cache: blocked
  BEFORE tests by FileLockContentionHandler unusable wildcard IP. No Gradle pass.
- Existing relevant backend tests compiled with javac 25 and run via isolated JUnit
  Platform against cached dependencies/unchanged existing main classes: 15/15 PASS,
  zero failures/errors/skips. IotControllerTests, IotIngestionTests, MqttGatewayTests,
  IotErrorDispatchTests, IotOpenApiTests and AiDetectionContractTests. Initial broad
  cache classpath selected old SLF4J 1.x and failed seven context tests; filtered the
  conflicting old SLF4J from this temporary harness, all 15 passed. This is not a
  full Gradle/database/broker validation. Existing backend reports not overwritten.
- Frontend native Node unit tests: 12/12 PASS, no skips. Covers exact API contracts,
  nullable/malformed values, soil masking, timestamp status/confirmation, security,
  signed sessions, Origin/body checks, status/error sanitization, no command retries,
  real AI paths and polling overlap/pause/disposal.
- Frontend ESLint and full TypeScript check PASS with locally available tooling.
  npm ci actual installation failed on registry.npmjs.org EAI_AGAIN DNS. To make
  progress without changing pinned versions, temporarily copied an existing local
  dependency directory for checks: TypeScript 5.9.3, ESLint 9.39.5,
  typescript-eslint 8.70.0, React 19.2.8, Next 16.3.5 (not pinned 16.3.8).
  Therefore type checks using Next types are compatibility evidence, not validation
  of a successful locked dependency installation.
  Temporary dependencies and failed .next build output were moved out of the
  repository to /tmp before handoff; normal npm ci must install the pinned stack.
- Production build ATTEMPTED with temporary local Next 16.3.5: blocked by sandbox
  Turbopack CSS processing, process/port binding Operation not permitted. No passing
  production build asserted; installed temporary Tailwind stack also differs from
  the locked app and is not used as deployment evidence. Initial external symlink
  was rejected by Turbopack; replaced with a writable local copy for that attempt.
- Exact lockfile npm ci --dry-run --offline PASS; pre-existing dependency versions
  unchanged. This validates dependency planning only, not tarball installation.
- git diff --check PASS; IoT secret references only in server-only adapter/template.
  Real secret files unread/unmodified. No upload, live MQTT command, broker stop,
  database mutation, commit, push or remote deployment.

### Final local acceptance / checkpoint authorization

User reported successful local validation: npm ci, npm run lint, npm run
typecheck, npm run test and npm run build all PASS. This supersedes the earlier
sandbox installation/build blockers above; those remain historical evidence,
not outstanding local acceptance gates. No new full backend Gradle run claimed.

User reported real browser acceptance PASS: frontend loads, authentication works,
grow-room-1 appears, actual temperature/humidity display, soil remains unavailable
(sensor not installed), device health/last-seen updates, and actuator controls
call the real backend. Frontend pump command reached Spring -> MQTT -> ESP32;
ESP32 reported pump ON, the physical relay switched ON, firmware auto-off occurred
after approximately 10 seconds, and frontend subsequently reflected pump OFF.
These are user-observed local results, not automated hardware checks here.

Verified: frontend monitoring and full frontend-to-physical-relay control path.
Still deferred/unverified: actual water pump/load operation, physical fan/light,
real soil sensor, calibration and soil telemetry, remaining physical actuator
safety acceptance. AI read integration is implemented and tested; no additional
live AI detection acceptance is inferred from the reported browser results.
New monitoring Khmer translations remain for native review.

Final diff/work log reviewed before checkpoint. User explicitly authorized NEW
commit `feat(client): integrate real grow-room monitoring and actuator control`
and push `feat/grow-room-monitoring` to origin with upstream tracking. Do not
amend previous commits or merge to main. Backend/AI/firmware remain unchanged.

## IoT dashboard continuation audit — 2026-10-24

Reconciled requested checkpoints: api/main f66e05d, frontend on
feat/grow-room-monitoring edb5152, firmware/main bbf860d and AI/feat/live-camera
c2b8b00. Frontend/backend/firmware initially clean; existing AI log changes and
untracked acceptance document preserved. No AI/backend/firmware modifications.
Read frontend Phase 9 log/guide, backend IoT log, controller/entity/DTO contracts,
authentication and current proxy/dashboard/polling/tests before editing.

Phase 9 already supplies real state/telemetry, authenticated server-only REST
proxy, guest read-only enforcement, actuator commands, separate AI reads, soil
masking, error messages, no-overlap polling and pump timeout messaging. Reused all
of it. Missing edge cases: a report received during the HTTP POST was ignored for
confirmation, and a report after the 20s waiting window could never clear the
unconfirmed message. Added pure command observation/acceptance helpers to retain
reports racing HTTP202 and recognize late matching reports without retries,
optimistic physical state or changing firmware. Dashboard now labels fresh state
ONLINE (previously Active). Current ON/OFF still comes only from ESP32 reports;
confirmation is historical and does not prevent subsequent pump OFF display.

Validation in this sandbox:
- Installed dependency tree is valid (`npm ls --depth=0`); pinned Next16.3.8 and
  React19.2.8 present. Preserved working node_modules instead of destructive npm ci;
  `npm ci --dry-run --offline --ignore-scripts` PASS (planning, not installation).
- npm run lint PASS; npm run typecheck PASS; npm run test 13/13 PASS.
- npm run build FAILED: Turbopack CSS process cannot bind a port (Operation not
  permitted). Additional `npm run build -- --webpack` FAILED: could not parse
  TypeScript --showConfig output. No production build pass claimed. Run standard
  build in normal developer terminal before commit.
- git diff --check PASS. Backend unchanged, no backend tests needed.
- No real browser/hardware actuation this turn. Await user acceptance below.
- No commit, push, merge, staging, secret/config edits or private secret reads.

Current acceptance gate: repeat browser/ESP32 checks in docs/phase9-integration.md.
Previous user-reported Phase 9 acceptance remains historical; this new change has
NOT received real acceptance. GPIO27/physical relay remain verified; actual water
pump/load, physical fan/light, soil sensor/calibration/telemetry remain unverified.
New ONLINE label uses existing translation fallback; Khmer review remains pending.
Proposed commit: fix(client): confirm racing and late ESP32 actuator reports


## Checkpoint verification — 2026-10-25

Current combined frontend tree passes npm run test, lint and typecheck in this
session. User ran npm run build on the normal machine and reports PASS; this
supersedes the sandbox port-bind limitation for checkpoint acceptance. User also
reports physical live frontend/AI pipeline operation. This does not claim model
accuracy or additional physical actuator acceptance. Private .env.local remains
ignored. The actuator and live-scan changes separate cleanly by file, so checkpoint
uses two new commits with no history rewrite. Generated CLAUDE.md is left local.
