# SmartPhset web app: developer guide

For Hout (frontend) and the hardware engineer (Node.js backend). It covers how the app is built, how to run and
change it, how it talks to the laptop, and how it deploys.

- **Live:** https://smartphset.vercel.app
- **Repo:** github.com/menghoutishere-code/SmartPhset-Prototype-Frontend (private)
- **API contract:** [api-contract.md](api-contract.md)
- **User guide:** [user-guide.md](user-guide.md)

---

## 1. Stack

| Part | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styles | Tailwind CSS 3 with the design tokens exported from Google Stitch ("Calm Field Instrument"), unchanged in `tailwind.config.ts` |
| Fonts and icons | Plus Jakarta Sans (Latin), Kantumruy Pro (Khmer), Material Symbols Outlined (subset of the icons we use). **Self-hosted** in `public/fonts` + `src/app/fonts.css` (no Google Fonts at runtime). Re-generate the subset when you use a new icon. |
| State | One React context (`src/lib/store.tsx`), in the browser |
| Hosting | Vercel (project `smartphset`), auto-deploys from GitHub `main` |

There is no database in the website. Data lives on the laptop backend; until that is connected, the app runs in
**demo mode**.

## 2. Folder map

```
src/
  app/
    layout.tsx              root: fonts, <html lang>, LangProvider
    globals.css             Tailwind + Khmer line-height rules
    fonts.css               self-hosted @font-face rules (generated)
    not-found.tsx           branded 404
    signin/page.tsx         the first screen (login or guest)
    (app)/                  every signed-in page shares this frame
      layout.tsx            StoreProvider + Sidebar + Topbar + MobileNav
      page.tsx              Overview (all-rooms strip + room detail)
      scan/page.tsx         take or upload a photo
      scan/[id]/page.tsx    one scan result
      history/page.tsx      all scans, filter by room and level
      alerts/page.tsx       alerts, filter, details, resolve
      climate/page.tsx      readings, targets, manual control, activity (per room)
      status/page.tsx       health of each room and shared parts
      settings/page.tsx     language, account, rooms, alert levels, about (server component)
      setup/page.tsx        camera setup guide (server component)
    api/
      auth/signin           POST: login or guest -> session cookie
      auth/signout          GET: clear session -> /signin
      images                POST: photo -> AI (laptop) or {demo:true}
      readings/latest       GET ?device=: latest reading or {demo:true}
      health                GET: is the laptop reachable
  components/
    Shell.tsx               Sidebar, Topbar (room switcher, language), MobileNav
    ScanPhoto.tsx           photo + AI boxes drawn in SVG in the photo's own pixels
    LangChoice.tsx          language picker (Settings) and compact toggle (sign-in)
    TrendChart.tsx          per-room demo trend chart (ends at the live reading)
    ResetDemo.tsx           clears the saved demo state
  lib/
    types.ts                Room, Reading, Scan, Alert, Settings (shapes from api-contract.md)
    data.ts                 rooms, sample data, alert-level rules, small helpers
    store.tsx               app state + the demo simulation of each room
    auth.ts                 session cookie, guest switch, safe redirect check
    session.ts              currentUser() for server components
    backend.ts              BACKEND_URL / BACKEND_MODE / API_KEY forwarding helpers
    i18n-core.ts            translate()
    i18n.tsx                LangProvider, useT(), useLang() (browser)
    i18n-server.ts          getT(), getLang() (server components)
    km.ts                   Khmer text, keyed by the English text
    mock/history.json       12 real scans: real photos + our model's real results
  proxy.ts                  onboarding gate (Next.js 16 "proxy", formerly middleware)
public/
  brand/                    logo (SVG/PNG), favicon, app icons, share image
  mock/                     the 12 real bag photos used by the demo scans
  photos/                   sign-in hero and other photos
  stitch/                   two Stitch illustrations used on /setup
docs/                       this guide and the rest of the docs
```

## 3. Run it

```bash
npm install
npm run dev        # http://localhost:3000 (hot reload)
npm run build      # production build + type check (run before every push)
npm run start      # serve the production build
```

**Windows notes:**
- On a slow or flaky connection, use
  `npm install --prefer-offline --fetch-retries=6 --fetch-timeout=600000 --maxsockets=4`.
- **Git Bash rewrites arguments that start with `/`.** Use `export MSYS_NO_PATHCONV=1` before `curl` tests that pass
  paths.

## 4. How a visit works (onboarding and login)

1. **No session:** `src/proxy.ts` sends every page to `/signin?next=<page>`. API calls get `401`.
2. **On `/signin`:**
   - **Username + password** checks `AUTH_USER` / `AUTH_PASSWORD`. With no password set, it answers "Team accounts
     are not set up yet".
   - **Continue without an account** creates a **guest** session, if `ALLOW_GUEST` isn't `"false"`.
3. **The session** is an HttpOnly cookie `sp_session = <user>.<HMAC-SHA256>`, signed with `AUTH_SECRET` (falling
   back to `AUTH_PASSWORD`). It lasts 14 days, and is `Secure` over HTTPS.
   - **Fails closed:** with no team accounts configured, only `guest` sessions are accepted, so a forged named
     cookie unlocks nothing.
   - **Redirects** are relative (`Location: /signin`), so sign-in also works over a LAN address.
4. **Return page:** after login you go back to `next`. `safeNext()` only allows plain same-site paths; it blocks
   `//host`, `/\host`, schemes and control characters, and checks again after URL normalisation (so `/.//host`
   is blocked too).
5. **Sign out:** `/api/auth/signout` clears the cookie and returns you to `/signin`.

Before connecting real hardware, either set a team password and `ALLOW_GUEST=false`, or decide what guests may do.
Today a guest can use everything, including manual control.

## 5. Rooms

- **Defined in** `ROOMS` in `src/lib/data.ts`: `{ id, name, device, bags }`. Each room has its own controller
  (`device`, for example `esp32-1`).
- **The store keeps, per room:** reading, settings (targets and overrides), and climate activity. Scans and alerts
  carry a `room` field.
- **Current room:** `useStore().room` / `setRoom(id)`, remembered in `localStorage` (`sp_room`).
- **Room status** (`statusOf(roomId)`): `offline` → `mould` (an open red alert) → `check` (an open mould alert) →
  `climate` (outside its targets) → `ok`.
- **Adding a room:** add it to `ROOMS`, add a starting reading in `INITIAL_READINGS`, and add `"Room 4"` to
  `km.ts`. Rooms will come from the backend later.

## 6. Data and the demo simulation

- **No backend:**
  - Each room's reading changes every 5 s.
  - The mister turns on below `rh_low` and off at `rh_high`.
  - The fan runs above `temp_max` or on a fresh-air schedule.
  - Overrides force on or off for 10 minutes.
  - Room 3 is set to run warm, to show the climate state.
- **Scans:** `mock/history.json` holds real photos with our model's real results (run 2026-10-03, YOLOv8n,
  confidence 0.4).
- **Taking a photo in demo mode** returns one of the saved examples, marked `demo: true` and labelled on screen:
  - Uploading one of our sample files (`bag-red.jpg`, `bag-amber.jpg`, `bag-green.jpg`, `bag-none.jpg`,
    `scan-05.jpg`…) shows **that photo's own real result**. Use these for a predictable live demo.
  - Any other photo cycles red → amber → green → grey.
- **Alert levels** (`levelOf()` in `data.ts`) use **only `max_contaminated_conf`**:
  - Red at ≥ 0.80, amber at 0.40–0.79.
  - `no_detection` / `camera_error` → grey "Could not check", never healthy.
- **Demo state is saved on the device** for 12 hours (`localStorage`, key `sp_demo_v1`): scans, alerts, targets,
  overrides and activity, so a reload mid-demo changes nothing. **Settings → Reset demo data** starts fresh.
- **Times** are Cambodia time (UTC+7). The sample timeline moves so it ends a few minutes before "now".

## 7. Connecting the laptop backend

The browser only calls this website (`/api/...`). The website's server forwards to the laptop through the tunnel
and adds the key. Set these in **Vercel → Project → Settings → Environment Variables**, then redeploy:

| Variable | Meaning |
|---|---|
| `BACKEND_URL` | Tunnel address of the laptop, for example `https://xyz.trycloudflare.com` (no trailing slash). Empty = demo mode. |
| `BACKEND_MODE` | `bridge` = send photos to `bridge.py` (the Python AI) directly; `api` = the engineer's Node REST API |
| `API_KEY` | Shared secret, sent as `Authorization: Bearer <key>`; must match the laptop |
| `AUTH_USER`, `AUTH_PASSWORD`, `AUTH_SECRET` | Team login (see section 4) |
| `ALLOW_GUEST` | `false` turns off "Continue without an account" |

**`bridge` mode** (the fastest way to get real AI results on the live site):
1. On the laptop, start the AI from the [SmartPhset-AI](https://github.com/menghoutishere-code/SmartPhset-AI) repo,
   using the same key:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   $env:BRIDGE_API_KEY = "<the key>"
   python bridge.py --api-key $env:BRIDGE_API_KEY
   ```
   First-time setup is in that repo's `docs/run-the-bridge.md`.
2. Start a tunnel to its port: `cloudflared tunnel --url http://localhost:8000`.
3. Set `BACKEND_URL`, `BACKEND_MODE=bridge` and `API_KEY` in Vercel.
4. Phone photos are then checked by the real model.

Readings stay simulated in this mode, because `bridge.py` has no readings.

**`api` mode:** the engineer's Node API implements [api-contract.md](api-contract.md):
- `/api/images` returns the photo result.
- `/api/readings/latest?device=esp32-N` returns each room's reading.
- `/api/health` reports health.

The app polls readings for every room every 10 s and switches the "Demo data" tag off once real data arrives.

## 8. Language (English and Khmer)

- **In code,** always write `t("English text")`:
  - **Browser components:** `const t = useT()`.
  - **Server components:** `const t = await getT()`.
- **Placeholders:** `t("{n} bags", { n: 3 })`.
- **Khmer lives in `src/lib/km.ts`,** keyed by the exact English text. A missing key falls back to English, so
  nothing breaks.
- **The choice is stored** in the cookie `sp_lang` (`en`/`km`). It sets `<html lang>`, and `globals.css` adds extra
  line height for Khmer.
- **Font:** Khmer letters fall back to Kantumruy Pro automatically (it is in every font stack in
  `tailwind.config.ts`).
- **To correct a translation,** edit its line in `km.ts`. **The Khmer is an AI-written draft and must be checked by a
  native speaker before the demo.**

## 9. Design rules

- **Use the Stitch tokens** (`bg-surface-container-lowest`, `text-on-surface-variant`, `font-headline-sm`, and so on).
  Don't hard-code new colours.
- **Status = colour + icon + word, always.** Grey "Could not check" must never look or read like green.
- **Gold (`secondary-container`) is for the AI actions** ("Take photo", Scan).
- **Logo:** use `/brand/logo-mark.svg` and `/brand/logo-full.svg`. Never redraw it. See [assets.md](assets.md).
- **Honesty rules for any text:**
  - No CO₂ numbers.
  - No mould-type (species) claims.
  - The fan "ventilates", never "cools".
  - Demo data is always labelled.
  - "AI checks are suggestions" stays visible.

## 10. Security headers

`next.config.ts` sends `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`,
`X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` on every page.

## 11. Deploy

- **Every push to `main`** on GitHub deploys to https://smartphset.vercel.app automatically (the Vercel project is
  linked to the repo).
- **Before pushing:** `npm run build` must pass.
- **Pushing from the team laptop:** use the SSH alias `git@github-menghout:...` so commits go to Hout's account.
- **Never commit `.env` files or tokens.** `.gitignore` blocks `.env*` except `.env.example`.

## 12. Testing

There are no automated unit tests yet. What exists:
- **`npm run build`:** the type check.
- **Manual and agent testing:** puppeteer-core driving Chrome, as desktop (1440) and phone (390). It checks the
  sign-in flow, room switching, scan upload, alert resolution, overrides, Khmer, and redirect safety.
- **Quick HTTP checks:**
  ```bash
  export MSYS_NO_PATHCONV=1
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/            # 307 -> /signin
  curl -s -X POST -d "mode=guest" -D - -o /dev/null http://localhost:3000/api/auth/signin   # 303 + Set-Cookie
  ```

## 13. Known limits and next steps

The full test results are in [testing-report.md](testing-report.md).

| Limit | Next step |
|---|---|
| Demo state is per device (saved 12 h), not shared | Comes from the backend once connected |
| Climate charts are demo trends per room | Draw from `GET /readings?from&to` when the backend has history |
| Team accounts not configured | Set `AUTH_PASSWORD` (+ `AUTH_SECRET`); later, real per-user accounts |
| Guests can use manual control | Decide guest permissions before real hardware |
| Rooms are fixed in code | Load rooms from the backend; add or rename them in Settings |
| Khmer is a draft; some data text is English | Native review of `km.ts`; translate alert details on the backend |
| Sign-in hero photo is a low-resolution Stitch image | Replace `public/photos/signin-hero.jpg` |
