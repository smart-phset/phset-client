# SmartPhset web app

The SmartPhset website: AI mould checks and climate control for oyster-mushroom grow rooms. Design from
Google Stitch ("Calm Field Instrument"), built with Next.js 16, React 19 and Tailwind CSS 3.

**Phase 9:** Overview and Climate now monitor the real Spring IoT API and control
fan/light/pump outputs through authenticated server routes. Scan History uses real
persisted AI detections. Setup, exact API contracts and validation commands:
[Phase 9 integration guide](docs/phase9-integration.md). IoT keys remain server-only;
guest access is read-only. Soil is unavailable because no sensor is installed.

**Live:** https://smartphset.vercel.app · **Docs:** [docs/README.md](docs/README.md) (user guide, developer guide, API contract).
**The AI** (`bridge.py` and the trained model) is in a separate repo:
[SmartPhset-AI](https://github.com/menghoutishere-code/SmartPhset-AI).
**Working on it?** Read [CONTRIBUTING.md](CONTRIBUTING.md) first (branches, checks, never commit keys).

Visitors start at a sign-in screen: team login (when configured) or **Continue without an account**. The farm has
one configured real device on the monitoring pages. Other prototype pages retain
their room previews. The interface uses **English and Khmer** (new monitoring text
currently falls back to English; Khmer wording requires review).

## Pages

| Path | Page |
|---|---|
| `/` | Real grow-room state, temperature/humidity, actuator controls and latest AI result |
| `/scan` | AI scan: take or upload a bag photo |
| `/scan/[id]` | One scan result, with the AI's boxes on the photo |
| `/history` | Latest 20 real stored detections for the configured camera |
| `/alerts` | Open and resolved alerts, with details |
| `/climate` | Real device monitoring and fan/light/pump controls |
| `/status` | System status of every part |
| `/settings` | Language, alert levels, hardware, about |
| `/setup` | Camera setup guide |
| `/signin` | First screen: team login or continue without an account |

## Run it

```
npm install
npm run dev          # http://localhost:3000
npm run build        # production build check
```

## Legacy prototype pages

The remaining prototype pages use the older `BACKEND_URL` demo/bridge setup.
This does not configure Overview, Climate or History; those never fall back to demo
data. Prototype pages carry a visible preview notice. With no `BACKEND_URL`:
- The grow box readings are simulated.
- Scan photos are **real** bag photos with our model's **real** results (`public/mock/`).
- A new photo shows a saved example, and says so on screen.

To connect the laptop, set the variables in `.env.example`:
- `BACKEND_MODE=bridge` sends phone photos to `bridge.py` (the Python AI, in the
  [SmartPhset-AI](https://github.com/menghoutishere-code/SmartPhset-AI) repo) through the tunnel.
- `BACKEND_MODE=api` sends everything to the engineer's Node REST API (`docs/api-contract.md`).

The browser only talks to this website. Its server routes (`src/app/api/`) forward calls to the laptop with
the API key.

## Where things are

- `src/app/` holds the pages and API routes.
- `src/components/Shell.tsx` holds the sidebar, top bar and mobile navigation.
- `src/lib/data.ts` and `src/lib/store.tsx` hold the sample data, alert levels, and the shared app state (including
  the box simulation).
- `tailwind.config.ts` holds the Stitch design tokens, unchanged.
- `docs/` holds the plan, API contract, design prompts and assets guide.

AI checks are suggestions. Confirm by looking at the bag.
