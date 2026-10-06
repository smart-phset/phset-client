# Testing report (2026-10-04)

Three AI test agents used the app like real people, each driving Chrome. Then the fixes were re-checked with a
verification script and HTTP tests.

| Tester | Viewport | Focus | First result |
|---|---|---|---|
| Farmer | Phone 390 × 844, Khmer | Can a non-technical grower use it? | Fast and stable in Khmer, but the scan demo always failed and a reload undid everything |
| Judge | Desktop 1440 × 900, English | Would it impress, and is it honest? | **6/10**: polished and honest, but the live scan failed and icons sometimes showed as words |
| QA | 320–1440 px, both languages | Security, edge cases, accessibility | 2 security issues and 6 functional bugs; everything else passed |

## Fixed and verified

| Problem (who found it) | Fix | Verified by |
|---|---|---|
| Every uploaded photo showed "Could not check" (all three) | The demo counter advanced once per item checked instead of once per photo. Fixed. Uploading one of our sample photos (`public/mock/bag-red.jpg`) now shows that photo's real result. Other photos cycle through real examples, starting with the 94% red one. | Script: bag-red.jpg → "Likely mould 94%" |
| A new demo scan looked "already reviewed" (found in re-test) | New scans clear the copied review mark | Script: "Bag removed" button present |
| Icons showed as words ("grid_view") on slow Wi-Fi (judge, QA) | Fonts are now hosted by the app itself (85 KB icon subset + Plus Jakarta Sans + Kantumruy Pro), with no Google Fonts at runtime | Script: icon font loaded, no icon wider than 60 px |
| Open redirect: `next=/.//evil.com` escaped after URL normalisation (QA) | `safeNext()` checks the path again after normalising | curl: 6 attack variants all → `/` |
| A session cookie could be forged with the built-in fallback key (QA) | Fails closed: with no accounts configured, only guest sessions are accepted; a named user needs `AUTH_PASSWORD` | curl: forged "admin" cookie → redirected to sign-in |
| Sign-in over local Wi-Fi redirected to localhost and lost the cookie (QA) | Relative redirects; the `Secure` cookie flag only over HTTPS | curl: `Location: /signin`, no `Secure` over http |
| Gate skipped `/api/authz`-style paths (QA) | Exact prefixes in the matcher | curl: `/api/authz` → 401 |
| Malformed sign-in request crashed (500) (QA) | Caught; returns to sign-in with a message | curl: 303 |
| No anti-framing protection (QA) | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, referrer policy | curl: headers present |
| A reload undid every action (farmer, QA) | Demo state (scans, alerts, targets, overrides, activity) saved on the device for 12 hours; **Settings → Reset demo data** | Script: resolved alert still resolved after reload |
| Resolved times in UTC, 7 hours off (all three) | All new times are Cambodia time (UTC+7); the sample timeline moves to end a few minutes before now; Today/Yesterday use the real date | Script: resolved time = local time |
| Resolving an alert left its scan "Review needed", plus a stale History banner (judge, QA, farmer) | Resolving an alert records the answer on its scan; sample scans carry their past answers | Script, and the History banner only for unreviewed scans |
| Overview said "both in auto mode" during manual control, and "fan ventilating" with the fan off (judge, QA, farmer) | Wording follows the real override and fan state | Script |
| "Rooms need attention" disagreed with Alerts (judge) | Room 3's heat is now a real open climate alert | Script: "2 of 3 rooms need attention" = 2 open alerts |
| Chart ignored room and time range (judge, QA) | New chart per room and range, ending at the live reading (clearly labelled as a demo trend) | Script: the path changes with range and with room |
| "Continue without an account" below the fold on phones (farmer) | While team accounts are off, it is the main button at the top; the form is "coming soon" | Script: button at y = 637 of 844 |
| Verdict and buttons below the photo on phones (farmer) | On phones the result card comes first | Script: buttons at y = 591 |
| English left in Khmer: alert details, activity reasons, box labels, chart buttons, credit (farmer, QA) | Pattern-based translation of data sentences (numbers kept); new strings added to `km.ts` | Script: alert details in Khmer |
| "Upload from computer" on a phone (farmer) | "Upload a photo" | |
| Failed photo showed "Highest mould confidence 0%" (farmer) | Shows "could not be checked, take another photo" | |
| Room switcher only showed coloured dots (farmer) | Shows each room's status in words; Escape closes it | |
| Raw browser error for non-image files; the same file could not be re-chosen (QA) | Friendly message; the input resets after each choice | |
| Icon names read aloud by screen readers; missing page headings; icon-only buttons unnamed (QA) | `aria-hidden` on 115 icons; hidden `h1` on scan, alerts and climate; labels on sign-out, settings, steppers and the room switcher; alert cards keyboard-operable | |
| Default Next.js 404 (QA) | Branded, translated "Page not found" | curl |
| Small touch targets (farmer) | Larger language switch, avatar, room chips, steppers and room select | |

## Still open

| Item | Why it is open | Owner |
|---|---|---|
| **Khmer wording needs a native check**, especially the word for mould (ផ្សិតចម្លងរោគ, since ផ្សិត is also the crop) | AI-written draft; the farmer tester's table has suggestions, marked confident or unsure | Hout and growers |
| Some Khmer secondary text is 11 px; a few chips are still under 44 px | Needs a design pass on the Stitch type scale for Khmer | Hout |
| Room picker arrow keys; status room cards not keyboard-focusable | Minor accessibility polish | Frontend |
| Example photos show 4 bags at once, while the guide says "one bag" | They are real dataset photos; consider choosing single-bag examples | Team |
| No SMS, Telegram or push alerts; no "value saved" figure | Product gaps judges may ask about | Team |
| The `Secure` cookie flag on Vercel (HTTPS) | Logic is in place; confirm on the live site after deploy | Verified after deploy |
| Demo state is per device, not shared | Real state comes from the backend | Engineer |
