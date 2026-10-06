# SmartPhset web app

The SmartPhset website: AI mould checks and climate control for oyster-mushroom grow rooms. Design from
Google Stitch ("Calm Field Instrument"), built with Next.js 16, React 19 and Tailwind CSS 3.

**Live:** https://smartphset.vercel.app · **Docs:** [docs/README.md](docs/README.md) (user guide, developer guide, API contract).
**The AI** (`bridge.py` and the trained model) is in a separate repo:
[SmartPhset-AI](https://github.com/menghoutishere-code/SmartPhset-AI).
**Working on it?** Read [CONTRIBUTING.md](CONTRIBUTING.md) first (branches, checks, never commit keys).

Visitors start at a sign-in screen: team login (when configured) or **Continue without an account**. The farm has
**several rooms** (switch in the top bar), and the interface works in **English and Khmer** (Khmer is a draft under review).

## Pages

| Path | Page |
|---|---|
| `/` | Overview: status, live readings, last AI check, alerts |
| `/scan` | AI scan: take or upload a bag photo |
| `/scan/[id]` | One scan result, with the AI's boxes on the photo |
| `/history` | All scans, filtered by level |
| `/alerts` | Open and resolved alerts, with details |
| `/climate` | Readings, targets, manual fan/mister control, activity log |
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

## Demo mode and the real backend

With no `BACKEND_URL`, the site runs in **demo mode**:
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
