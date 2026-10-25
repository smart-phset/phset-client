# Contributing

How Hout and the engineer work on this repo. Start with the current [cross-platform setup](README.md). The older technical guide is
[docs/developer-guide.md](docs/developer-guide.md).

## Who owns what

| Area | Owner | Repo |
|---|---|---|
| Website, login, Vercel | Hout | this repo |
| Spring REST API, database, ESP32 hardware | Engineer | the backend repo |
| AI (`bridge.py`, the model) | Hout | [SmartPhset-AI](https://github.com/smart-phset/phset-ai) |
| The API contract between them | Both | [docs/api-contract.md](docs/api-contract.md) |

The owner reviews and merges changes in their area. Anything in the API contract needs both of you to agree.

## Workflow

**Every push to `main` goes live** on https://smartphset.vercel.app. So:

1. Start from the current feature branch named in README.md, then make a branch: `git switch -c fix/short-name` (or `feat/...`, `docs/...`).
2. Commit and push the branch. Vercel builds a **preview link** for it (shown on the pull request); test there.
   If the link asks for a Vercel login, ask Hout to open it or to add you to the Vercel project.
3. Open a pull request to the agreed integration branch, with what changed and how you tested it.
4. The owner of that area reviews and merges. Use a feature branch and Pull Request for documentation changes too.

**Before the National Challenge (Oct 23-25, 2026):** from Oct 20, no merges to `main` without both of you saying
yes. Demo day is not the day to find a broken build.

## Before you open a pull request

- `npm run build` passes locally (it type-checks too).
- You clicked through the pages you touched, on a phone-width window as well.
- New text on screen uses `t("...")`, with the Khmer added to `src/lib/km.ts` (or flagged in the PR so Hout can
  add it).
- If you changed what the website sends or expects from the backend, `docs/api-contract.md` is updated **in the
  same pull request**.

## Never commit

- `.env`, `.env.local`, tokens, API keys, passwords. Real values go in Vercel -> Settings -> Environment
  Variables. Only `.env.example` (with empty values) is in git.
- Real farmer names, phone numbers or locations.
- Large files. Photos for the app go in `public/` and should stay under about 500 KB each.

If a secret is ever committed, tell Hout at once: the key has to be changed, because deleting the commit is not
enough.

## Rules for anything the user sees

- **Status = colour + icon + word.** Grey "Could not check" must never look like healthy green.
- **No CO2 numbers** (there is no CO2 sensor), no mould-type claims, nothing "guaranteed".
- **AI results are suggestions.** Keep the "confirm by looking at the bag" wording.
- Use the Stitch design tokens in `tailwind.config.ts`, not new hard-coded colours.

## Commit messages

Short and in plain words, saying what changed: `Fix alert badge count after resolving`, not `update`.
