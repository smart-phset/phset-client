> Latest full-system audit: [full-system-audit.md](full-system-audit.md). The current final source has not passed a production build in this restricted session: Turbopack fails to bind its helper socket, and Webpack fails to read restricted TypeScript child output. Older successful Webpack runs below are historical. Runtime/browser acceptance remains pending.

# Production readiness validation — 2026-10-28

**Release decision: BLOCKED. No AWS deployment was performed.**

Baseline: frontend `feat/grow-room-monitoring`, existing uncommitted Camera Manager
work retained. Node 26.12.1, npm 12.2.1, Next 16.3.8, TypeScript 5.9.3. Docker
Compose 5.6.1 is installed, but daemon access is denied. Image targets supported
Node 24.22.1 LTS, whose container execution still requires verification.

| Check | Actual result | Limits |
| --- | --- | --- |
| `npm run test` | Passed all 6 frontend test files | Mocked transports/media, not physical devices |
| `npm run lint` | Passed, zero warnings | Source/tests lint |
| `npm run typecheck` | Passed on stable generated output | Run after build, not concurrently with it |
| `npm run build` | FAILED | Turbopack CSS helper loopback bind denied (`EPERM`) |
| `npm run build -- --webpack` | PASSED on latest rerun | Compiled, Next TypeScript passed, 14 static-generation tasks, traces and standalone output |
| Requested `npm run start -- --hostname 127.0.0.1 --port 3100` | FAILED | `listen EPERM` on 127.0.0.1:3100 |
| `docker compose -f compose.frontend.yaml config --quiet` with fixture image/path | Passed | Schema/interpolation only; no container started |
| Shell entrypoint and Node script syntax checks | Passed | Execution of network smoke script remains pending |
| `git diff --check` | Passed | No commits or pushes |
| AI `.venv/bin/python -m unittest discover -s tests -v` | 93 run: 92 passed, 1 skipped | Opt-in Spring/PostgreSQL test skipped; no new AI changes this task |
| Docker image build/runtime/UID/health/signals | NOT VERIFIED | Docker socket permission denied |
| Nginx syntax/TLS | NOT VERIFIED | Nginx executable/certificates unavailable locally |
| Production HTTP smoke / real browser / phone | NOT VERIFIED | Cannot bind a production server in this sandbox |
| Real ESP32/ESP32-CAM/MQTT/AWS commands | NOT PERFORMED | No physical actuation, firmware or live infrastructure changes |

The first typecheck attempt overlapped Next regenerating `.next/types`, causing
missing-file diagnostics. After avoiding that race, typecheck passed. The final
verification runs checks sequentially relative to builds. Never use a concurrent
build/typecheck failure as evidence of a source error.

## Reproduced environment root cause

`node scripts/diagnose-build-environment.mjs` produced:

```text
loopback-listen: {"allowed":false,"code":"EPERM"}
typescript-child: {"error":"EPERM","status":0,"stdoutBytes":0,"stderrBytes":0}
```

An earlier Webpack failure involved empty TypeScript child output. That failure
was not reproduced on the latest full Webpack run: the command exited 0 and
produced `.next/standalone/server.js`, static assets and the complete route table.
The diagnostic still reports restrictions; its spawn result must not be mistaken
for the result of the successful production build. Node 24 image execution is
still pending; this build used installed Node 26.12.1.

The final Turbopack log identifies:

```text
src/app/globals.css [app-client] (css)
creating new process
binding to a port
Operation not permitted (os error 1)
```

Webpack completed with all build/type checks enabled. Docker uses the verified
`npm run build -- --webpack` path. No ignoreBuildErrors, dependency patches,
feature removal or security weakening was used. Turbopack alone remains blocked
by the environment. The requested production start still failed with listen EPERM,
so successful compilation does not establish runtime/browser acceptance.

## Automated acceptance coverage that actually ran

- Existing actuator/monitoring/AI-alert regressions and mocked successful command
  contracts; transport spies prevent any real command publication.
- Default/USB/front/rear media constraints, independent stream owners, explicit
  disabled default, Stop/source-change cleanup and delayed permission races.
- Correct camera source association and stale/unknown severity; stream cancellation,
  fixed upstream targets, guest/anonymous access policy and no demo streaming.
- Python one-producer behavior, bounded latest frame, slow viewer frame skipping,
  stale-frame rejection and one viewer disconnecting without stopping peers.
- Production configuration validation, disabled shared/photo media without upstream
  capture/upload, relay credentials over HTTPS only, redirect refusal and sanitized
  responses, exact healthz exemption and safe cookie/redirect/guest behavior.
- Private raw-env parser preserves credential `$`, `#` and `=` without evaluating
  shell expressions or printing values.

These unit checks do NOT establish camera permission prompts in a real browser,
physical camera availability, sessionStorage isolation on actual devices, model
accuracy, a healthy AWS deployment or a single real inference process under load.
Follow `production-acceptance.md` for those gates.

## Deliverables and remaining release gates

Prepared Dockerfile, .dockerignore, loopback Compose service, runtime example,
Nginx HTTPS/streaming example, liveness/configuration guards, safe HTTP smoke script,
capability diagnostic and deployment/rollback/security/relay documentation. No
private environment file was modified, included in the image context, or printed.
Existing API/web-cam repositories remain clean on main. The AI repository retains
its prior camera changes; this task only reran its tests.

Before approval: Node 24 image build and vulnerability
review; standalone runtime, signals/resource measurements; real HTTP, browser and
HTTPS mobile acceptance; reviewed Nginx syntax/certificates/topology; review of
existing shared-auth token expiry/revocation limitations. Shared video/photo analysis
must remain disabled without separately accepted secure services. A relay alone
does not unblock protected Spring detection reads/history. No live security policy
was weakened to make a test pass.

## Latest artifact and configuration review

Verified `.next/standalone/server.js` exists after the successful Webpack build.
Scanned 48 generated browser static files against configured private values without
printing them. One password substring matched the public camera preference-key
prefix already present in source; it was not evidence of environment interpolation.
No other configured private value of at least eight characters matched this scan.
This is a targeted check, not a complete image-layer or secret audit.

The local development password is short and matches a public application identifier.
Do not reuse it for production. The production entrypoint rejects its length;
set a unique strong password in the private runtime file. No private env was changed.
Image-layer scanning and Node 24 runtime verification remain pending.
