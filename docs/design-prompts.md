# SmartPhset web app: design prompts for Stitch and Figma Make

Copy-paste prompts to design the SmartPhset web application. They follow our real features, the API contract
(`docs/api-contract.md`), and our honesty rules.

| Tool | Use it for | Rules it works best with |
|---|---|---|
| **Google Stitch** (stitch.withgoogle.com) | Finding the look, fast, screen by screen | One screen per prompt. Keep each prompt under ~5,000 characters, or it drops components. Edit with one or two changes at a time. |
| **Figma Make** | A clickable app that works with fake data, which you then port to Next.js | Put the whole brief in the first prompt. Use plan mode. Give it a guidelines file for the design system. Desktop layouts work best. |

**Recommended path:**
1. Stitch, sections 3-4 (1-2 hours): pick the look.
2. Figma Make, section 5: build the working prototype in that look.
3. Hout ports the components to Next.js.

You can also skip Stitch and go straight to Figma Make.

---

## 1. The thinking behind the design (step by step)

**1. Who uses it?**
- **Now:** our team and the judges, at a live demo.
- **Later:** a smallholder oyster-mushroom grower checking on a phone, often outdoors, sometimes reading Khmer.
- The design must convince judges **and** read as something a farmer could actually use.

**2. What jobs does it do?** Only four, in this order of importance:
1. "Is my crop OK right now?"
2. "Check this bag for mould."
3. "Is the climate in range, and can I step in?"
4. "What happened while I was away?"

Every screen serves one of these. Nothing else gets a screen.

**3. What data really exists?**
- **The box reports:** temperature, humidity, fan on/off, mister on/off, water tank OK, faults, online/last seen.
- **The AI returns:** a verdict, a level (green, amber, red or grey), the highest mould confidence, and boxes on
  the photo.
- **There is no CO2 sensor** and no harvest prediction. The design must never invent data we don't have. CO2
  shows as "Not measured".

**4. The design idea: "a calm field instrument".**
- Quiet when all is well, unmistakable when something needs attention.
- Precise like a good instrument: big honest numbers, clear units, no decoration competing with the signal.
- **Taste comes from restraint:** one accent for the AI, one primary action per screen, generous space, and
  real photos.

**5. Status must be readable without colour.**
- Every state is colour + icon + word: green "No mould seen", amber "Please check", red "Likely mould", grey
  "Could not check".
- Grey must never look like green. "Could not check" is not "healthy".

**6. Web app, two shapes:**
- A **desktop** dashboard for the demo screen and judges.
- A **phone** layout for taking bag photos and checking on the go.
- Design desktop first, then the three key phone screens.

**7. Honest words in the interface:**
- "AI suggests", with the confidence shown as a percentage.
- "The fan is ventilating", not "cooling".
- "Manual control ends by itself in 10 min".
- A footnote: "AI checks are suggestions. Confirm by looking at the bag."

**8. Khmer-ready:** an EN / ខ្មែរ toggle. Layouts need room for Khmer text, which runs longer and taller.

---

## 2. The design system (paste into every tool)

**Logo (use the real files; never redraw it):**
- The logo is a navy oyster mushroom whose gills turn into circuit lines, above the "SmartPhset" wordmark.
- **Files:** `public/brand/logo-full.svg` (mark + wordmark), `logo-mark.svg` (mushroom only), and `-white`
  versions for dark backgrounds. The full list is in `docs/assets.md`.
- **In design tools, attach** `public/brand/logo-full.png` and `logo-mark.png` as images.
- Sidebar: the mark at 32 px plus the wordmark. Sign-in page: the full logo.

**Colours** (navy and circuit blue are sampled from the logo):

| Role | Hex | Use |
|---|---|---|
| Logo navy | `#19325A` | Headings, sidebar active indicator, temperature chart line |
| Circuit blue | `#3383C7` | Humidity chart line and small decorative accents. Never for text, because its contrast is too low. |
| Brand blue | `#004AAD` | Links and primary buttons (except the camera) |
| Ink | `#0F1B2D` | Main text |
| Muted text | `#5B6472` | Secondary text, units |
| Canvas | `#F6F5F1` | Page background (warm off-white) |
| Surface | `#FFFFFF` | Cards |
| Hairline | `#E4E1DA` | Borders, dividers |
| AI gold | `#C99A06` | Fill only. Used **only** for the AI: the "Take photo" button and the AI badge. Gold text uses `#7A5A00`. |

**Status colours** (always paired with an icon and a word):

| Status | Text/icon | Background |
|---|---|---|
| Good, "No mould seen" | `#146C3A` | `#E7F4EC` |
| Check, "Please check" | `#8A5A00` | `#FDF3DC` |
| Act now, "Likely mould" | `#B42318` | `#FDE8E6` |
| Could not check / offline | `#475467` | `#EEF0F3` |

**Type:**
- **Plus Jakarta Sans** for Latin, **Kantumruy Pro** for Khmer (both Google Fonts).
- Numbers use tabular figures.
- Big readings at 44-56 px, semibold, with the unit at 40% of the size in muted text. Body 15-16 px. Small
  labels 12-13 px.
- Sentence case everywhere; no all-caps except tiny overline labels.

**Shape and space:**
- 8 px spacing grid. Cards 12 px radius; buttons and inputs 8 px radius.
- 1 px hairline borders, very soft shadows (no heavy drop shadows).
- Desktop content max 1280 px on a 12-column grid.

**Icons:** outline style, 1.5 px stroke (Lucide or Material Symbols Outlined).

**Imagery:**
- Real-looking photos of enclosed grow rooms: walls of white grow bags stacked on their sides, plastic neck collars facing the aisle, oyster clusters growing from the necks.
- Mould shows as green or black patches.
- No stock photos of people, no 3D blobs, no illustrations of robots.

**Avoid:**
- Gradients, glassmorphism, neon, emoji, and dark mode for the first version.
- Charts with more than two lines.
- Fake precision such as "98.7% accurate".

**Voice:**
- Short, plain, verbs first: "Check bag", "Refill water", "Take photo".
- Times in 24-hour format: "14:05".
- Temperature in °C; humidity in % with "RH" only in small labels.

---

## 3. Stitch: step 0, the zoom-out prompt (paste first)

Set the mode to **Web**, attach `public/brand/logo-full.png` and `public/mock/bag-green.jpg` as images, then
paste:

```
Design a web application called SmartPhset. It is an AI contamination-control dashboard for small oyster-mushroom farms in Cambodia. A small controller in the grow box measures temperature and humidity and automatically switches a fan and a mister. A phone camera photographs mushroom grow bags, and an AI model flags possible mould early so the farmer can remove one bag before mould spreads.

Users: a small farm team checking the box, and judges watching a live demo. It must feel trustworthy, calm and precise, like a well-made field instrument. Quiet when all is well, unmistakable when something needs attention.

Logo: use the attached SmartPhset logo exactly (a navy oyster mushroom whose gills become circuit lines, with the SmartPhset wordmark). Do not redraw it. Use the attached grow-bag photo for bag images.

Style: warm off-white canvas #F6F5F1, white cards with 1px hairline borders #E4E1DA and 12px radius, very soft shadows. Logo navy #19325A for headings; brand blue #004AAD for links and primary buttons; circuit blue #3383C7 only for the humidity chart line. Gold #C99A06 used ONLY for AI features (the "Take photo" button and AI badges). Ink text #0F1B2D, muted text #5B6472. Font: Plus Jakarta Sans, tabular numbers, large semibold readings with smaller muted units. Outline icons, 1.5px stroke. Sentence case. No gradients, no emoji, no glassmorphism, no stock photos of people.

Status system, always colour + icon + word: green #146C3A on #E7F4EC "No mould seen"; amber #8A5A00 on #FDF3DC "Please check"; red #B42318 on #FDE8E6 "Likely mould"; grey #475467 on #EEF0F3 "Could not check".

Layout: desktop, 1440px wide. Left sidebar 240px with the attached logo mark (32px) and the SmartPhset wordmark, navigation: Overview, AI scan, Climate, Alerts, Scan history, System status; at the bottom Settings and the signed-in user. Top bar: page title, a box selector "Grow box 1", a live pill "Live · updated 8 s ago" with a green dot, a language toggle "EN | ខ្មែរ".

Start with the Overview screen:
- Top row: a large status card (8 columns) saying "All good" with a green check icon and the sentence "Climate is in range. Last AI check found no mould (14:05)." Next to it (4 columns) a "Last AI check" card with a square photo of a white oyster-mushroom grow bag, a green "No mould seen" badge, the time, and a gold "Take photo" button.
- Second row: reading tiles. Temperature 27.4 °C (target up to 30 °C, small 6-hour sparkline). Humidity 88% (target 85–90%, small bar showing the band). Fan "On · ventilating" (Auto). Mister "Off" (Auto, last ran 2 min ago). Water tank "OK". CO2 "Not measured" in a muted tile.
- Third row: a 24-hour chart (8 columns) with temperature and humidity lines and a shaded humidity target band; a "Recent alerts" list (4 columns) with three items and level badges, and "View all".
- Small footnote: "AI checks are suggestions. Confirm by looking at the bag."
```

---

## 4. Stitch: screen prompts (one per message, in this order)

After step 0, send these one at a time. Each one starts a new screen. Fix the look on Overview first (section
4.9) before generating the rest, so every screen inherits it.

### 4.1 AI scan: result (desktop)
```
New screen, same app and style: "AI scan" (desktop). This is the most important screen.
Left (7 columns): a large photo of a white oyster-mushroom grow bag with two rectangles drawn on it in amber, the larger labelled "Possible mould 74%". Under the photo, a row: "Take another photo" (gold button with camera icon) and "Upload from computer" (secondary button).
Right (5 columns), a result card:
- A large amber level badge with icon: "Please check this bag".
- Plain sentence: "The AI found 2 areas that may be mould (highest 74% confidence)."
- "What to do" numbered steps: 1. Look closely at the marked area. 2. Green, black or pink spots mean mould: move this bag away from the others. 3. Tell us what you found.
- Two buttons: "Mould confirmed, bag removed" and "Looks fine to me".
- A collapsed "Details" row: model yolov8n, checked in 0.4 s, photo 1280 × 960, time 14:05.
Below both columns: "Recent scans", a strip of six square thumbnails, each with a small level badge (green, amber, red, grey).
Footnote: "AI checks are suggestions. Confirm by looking at the bag."
```

### 4.2 AI scan: before a photo, and while checking
```
New screen, same style: "AI scan – ready" (desktop). Left (7 columns): a large dashed drop area with a camera icon, the heading "Take or upload a bag photo", the text "Fill the frame with one bag face, in good light, without flash glare.", a gold "Take photo" button and a secondary "Upload from computer" button. Right (5 columns): a card "How the AI check works" with three short steps (Photo → AI looks for mould → You confirm) and a small note "Works best on close-up photos of bag faces."
Also show, as a second frame, the "checking" state: the uploaded bag photo slightly dimmed with a thin gold scanning line, and the text "Checking for mould… about 2 seconds".
```

### 4.3 AI scan: could not check, and red
```
New screen, same style: two variants of the AI scan result card side by side.
Variant 1, grey: badge "Could not check" with an eye-off icon. Sentence: "No bag was found in this photo." Help: "Move closer so one bag face fills the frame, and add light." Button: "Take another photo". This must look clearly different from the green state.
Variant 2, red: badge "Likely mould" with an alert icon, a photo with a red rectangle labelled "Likely mould 94%". Sentence: "The AI is fairly sure this area is mould (94% confidence)." Steps: "Remove this bag from the room now. Check the bags next to it." Buttons: "Bag removed" and "Not mould".
```

### 4.4 Climate
```
New screen, same style: "Climate" (desktop).
Left (8 columns): a chart card with a range switch 6 h | 24 h | 7 d. Two lines: temperature (°C, left axis) and humidity (%, right axis), a shaded band for the humidity target 85–90%, and small markers on the time axis where the mister or fan switched on. Under it, an "Activity" table: time, event, reason. Example rows: "14:02 Mister on – humidity 84.6%, below 85%"; "14:03 Mister off – humidity 90.1%"; "13:40 Fan on – temperature 30.2 °C, above 30 °C".
Right (4 columns):
- Card "Targets": a two-handle range slider for humidity 85–90%, a stepper "Ventilate above 30 °C", a primary "Save targets" button, and the note "The box applies new targets within 30 seconds."
- Card "Manual control": Fan with a segmented control Auto | On | Off; Mister with Auto | On | Off. Under the fan, an active override: "On for 10 min · back to Auto in 9:42". Note: "Manual control ends by itself."
- Card "Water tank": "OK", with a small float icon.
Top of the page: a slim status strip "Box online · last report 8 s ago".
```

### 4.5 Alerts
```
New screen, same style: "Alerts" (desktop).
Top: filter chips All | Mould | Climate | Device, and a toggle Open | Resolved.
A list of alert rows, each with a level icon and colour, title, one-line detail, time, and for mould alerts a small photo thumbnail:
- red "Likely mould on a bag" – "AI scan at 14:05, 94% confidence" – 14:05
- amber "Please check a bag" – "AI scan at 11:20, 74% confidence" – 11:20
- amber "Humidity below target" – "84.1% for 6 minutes, mister running" – 09:12
- grey "Box did not report" – "No data for 3 minutes, back online at 08:47" – 08:44
- amber "Water tank low" – "Mister paused until refilled" – yesterday 18:30
On the right, a details drawer open for the first alert: the photo with the red box, the AI result, and buttons "Open scan" and "Mark resolved".
Also design the empty state: a calm illustration-free card "No open alerts. The box is quiet."
```

### 4.6 Scan history
```
New screen, same style: "Scan history" (desktop). Filter chips by level: All, Likely mould, Please check, No mould seen, Could not check; and a date selector. A 4-column grid of photo cards: a square grow-bag photo with drawn boxes where flagged, a level badge, the time, and the camera name "Phone 1". Twelve cards with a realistic mix: mostly green, three amber, one red, one grey. Clicking a card opens the AI scan result layout.
```

### 4.7 System status
```
New screen, same style: "System status" (desktop). Used during demos to show that every part is alive. A grid of status cards, each with an icon, name, status pill and one detail line:
- Grow box controller – Online – last report 8 s ago, running 3 h 12 min
- Temperature and humidity sensor – OK – last reading 27.4 °C, 88%
- Water tank – OK
- Server (laptop) – Online
- AI service – Ready – model yolov8n, average check 0.4 s
- Database – OK
- Internet link – Connected
A secondary button "Check again" in the top right. One card shown in the grey offline state as an example: "Grow box controller – Offline – last report 3 min ago".
```

### 4.8 Sign in, settings, phone screens
```
New screen, same style: "Sign in" (desktop). Split layout: left half a calm full-height photo of white oyster mushrooms growing from bags, with the SmartPhset wordmark and the line "See mould early. Keep the harvest." Right half: a centred form "Sign in to SmartPhset", Username, Password, a primary "Sign in" button, and a small note "Team access only."
```
```
New screen, same style: "Settings" (desktop). Sections as simple cards: Language (EN | ខ្មែរ), Account (username, Sign out), Alert levels (read-only text: "Please check: the AI is 40% sure or more. Likely mould: 80% sure or more."), Grow box (name "Grow box 1"), About ("Prototype v0.1. The AI is a demo model trained on public photos; farm testing is in progress.").
```
```
New screen, same app and style, MOBILE 390 × 844: "Overview" for phone. Top: SmartPhset mark, "Grow box 1", the live pill. A status card "All good". A 2 × 2 grid of reading tiles (Temperature 27.4 °C, Humidity 88%, Fan On, Mister Off). The "Last AI check" card. A bottom navigation with Overview, Climate, a raised round gold camera button in the centre labelled "Scan", Alerts, More.
```
```
New screen, MOBILE 390 × 844: "AI scan" for phone. A large photo of a grow bag with an amber box "Possible mould 74%", under it the amber badge "Please check this bag", the one-sentence explanation, the three "What to do" steps, and a sticky bottom bar with two buttons "Mould confirmed" and "Looks fine". A small "Take another photo" link at the top.
```

### 4.9 Taste refinements (send one at a time, only if needed)
```
Reduce visual noise on this screen: remove any shadows heavier than a soft 1–2 px blur, make all card borders 1px #E4E1DA, and increase the space between card rows to 24px.
```
```
Make the reading numbers the hero: temperature and humidity values 52px semibold with tabular figures; units at 20px in muted grey #5B6472; labels 13px above the number.
```
```
Gold #C99A06 must appear only on the "Take photo" button and AI badges. Change any other gold element to brand blue #004AAD or neutral grey.
```
```
Check every status badge: each must have an icon and a word, not colour alone. The grey "Could not check" badge must use an eye-off icon and look clearly different from green.
```
```
Replace any stock photo of people with close-up photos of white oyster-mushroom grow bags in a dim, clean grow room.
```

**After Stitch:** copy the screens to Figma ("Copy to Figma") or export the code, and use them as the visual
reference in Figma Make.

---

## 5. Figma Make: a working prototype

### 5.1 Guidelines file
Create a guidelines file in the Make session (for example `Guidelines.md`) and paste section 2 (the design
system) into it, plus these rules:

```
Code rules:
- React + TypeScript + Tailwind. One component per file. Names: StatusPill, LevelBadge, ReadingTile, StatusHero, LastScanCard, ClimateChart, TargetsCard, ManualControlCard, AlertRow, AlertDrawer, ScanUploader, BoxOverlay, ScanResultCard, ScanGrid, SystemCard.
- All data goes through ONE file, src/api/client.ts. Every function returns the exact JSON shapes in the "Mock data" section. No component fetches data directly.
- client.ts has a mode switch: if BACKEND_URL is empty, return mock data; otherwise call `${BACKEND_URL}/api/...`. Default: mock.
- Never invent data fields that are not in the mock data. co2_ppm is always null and shows "Not measured".
- Level comes only from max_contaminated_conf: red >= 0.80, amber 0.40–0.79, green when bags are seen and nothing is flagged, grey when the verdict is no_detection or camera_error. Grey must never display as healthy.
- All user-facing text comes from one dictionary file src/i18n.ts with "en" and "km" keys.
- Accessibility: colour is never the only signal; 4.5:1 text contrast; 44px touch targets; respects reduced motion.
```

### 5.2 The first prompt (use plan mode)
```
Build a responsive web app called SmartPhset, following Guidelines.md exactly. It is an AI contamination-control dashboard for small oyster-mushroom farms. Desktop first (1440px), with phone layouts (390px) for Overview, AI scan and Alerts.

Pages and routes:
1. /signin – split layout, photo on the left, form on the right (username, password). In mock mode any non-empty username and password signs in; keep the session in memory.
2. / Overview – status hero (All good / Please check / Likely mould / Box offline, computed from the latest reading and latest scan), Last AI check card with gold "Take photo" button, reading tiles (temperature, humidity, fan, mister, water tank, CO2 "Not measured"), 24-hour chart with a shaded humidity target band, recent alerts list.
3. /scan – AI scan. States: ready (drop area + gold "Take photo" + "Upload from computer"), checking (photo dimmed, gold scanning line, "Checking for mould…"), result (photo with boxes drawn over it, level badge, plain explanation, "What to do" steps, buttons "Mould confirmed, bag removed" / "Looks fine to me", collapsible details), could-not-check (grey, eye-off icon, retry help), error ("Can't reach the AI right now. Try again.").
4. /climate – chart (6 h / 24 h / 7 d), activity table, Targets card (humidity range slider, ventilate-above temperature stepper, Save), Manual control card (fan and mister Auto | On | Off; On/Off lasts 10 minutes with a live countdown, then returns to Auto), water tank card.
5. /alerts – filter chips (All, Mould, Climate, Device), Open/Resolved toggle, alert list, details drawer with "Open scan" and "Mark resolved", empty state "No open alerts. The box is quiet."
6. /history – grid of past scans with level filter; click opens the scan result.
7. /status – system status cards (controller, sensor, water, server, AI, database, internet link) with a "Check again" button.
8. /settings – language EN / ខ្មែរ, account and sign out, alert levels explained (read-only), grow box name, About.

Behaviour (mock mode):
- Every 5 seconds the latest reading changes slightly (temperature 26–31 °C, humidity 82–93 %). When humidity drops below the lower target, mist_on becomes true until it reaches the upper target. When temperature passes the ventilate-above value, fan_on becomes true. Add a matching row to the activity table and, if humidity stays below target for 3 updates, add an amber climate alert.
- The live pill shows "Live · updated N s ago" and turns grey "Box offline" if no update for 90 seconds (add a hidden dev toggle to simulate offline).
- Take photo uses <input type="file" accept="image/*" capture="environment">. Before "upload", resize the image in the browser to max 1280px on the long side, JPEG quality 0.8. In mock mode, wait 1.2 s and return the next sample result from the mock list (cycling amber, green, red, grey). Draw each box from xyxy scaled by the displayed size / (width, height). A red or amber result also creates an alert.
- Feedback buttons store the answer on the scan and resolve its alert.
- Language toggle switches every label instantly.

Use the mock data in the next message as the single source of truth for data shapes. Start with a plan, then build the layout of all pages first, then the behaviour.
```

### 5.3 Second message: the mock data
```
Mock data for src/api/client.ts. Use these exact field names.

latestReading:
{"device":"esp32-1","time":"2026-10-10T14:02:30+07:00","temp_c":27.4,"rh":88.2,"fan_on":true,"mist_on":false,"water_ok":true,"fault":"","online":true,"co2_ppm":null}

targets:
{"rh_low":85,"rh_high":90,"temp_max":30,"fan_override":"auto","mist_override":"auto","override_until":null}

scanSamples (cycle through these; REAL results of our AI model on the real photos in public/mock/, also in public/mock/scans.json; photos are portrait or landscape, so always scale boxes by width and height):
[
 {"id":"s1","time":"2026-10-10T14:05:11+07:00","camera":"phone-1","verdict":"contamination_suspected","level":"amber","max_contaminated_conf":0.74,"n_contaminated":2,"n_healthy":0,"width":720,"height":1280,"boxes":[{"label":"contaminated","conf":0.74,"xyxy":[240,687,479,990]},{"label":"contaminated","conf":0.52,"xyxy":[174,525,363,817]}],"file_url":"/mock/bag-amber.jpg","model_version":"yolov8n-2026-06-20"},
 {"id":"s2","time":"2026-10-10T13:40:02+07:00","camera":"phone-1","verdict":"no_contamination_seen","level":"green","max_contaminated_conf":0,"n_contaminated":0,"n_healthy":4,"width":1280,"height":720,"boxes":[{"label":"healthy","conf":0.9,"xyxy":[567,392,862,713]},{"label":"healthy","conf":0.89,"xyxy":[197,113,581,387]},{"label":"healthy","conf":0.79,"xyxy":[632,127,907,387]},{"label":"healthy","conf":0.64,"xyxy":[250,407,558,707]}],"file_url":"/mock/bag-green.jpg","model_version":"yolov8n-2026-06-20"},
 {"id":"s3","time":"2026-10-10T12:15:47+07:00","camera":"phone-1","verdict":"contamination_suspected","level":"red","max_contaminated_conf":0.94,"n_contaminated":1,"n_healthy":0,"width":720,"height":1280,"boxes":[{"label":"contaminated","conf":0.94,"xyxy":[43,250,634,977]}],"file_url":"/mock/bag-red.jpg","model_version":"yolov8n-2026-06-20"},
 {"id":"s4","time":"2026-10-10T11:02:09+07:00","camera":"phone-1","verdict":"no_detection","level":"grey","max_contaminated_conf":0,"n_contaminated":0,"n_healthy":0,"width":1280,"height":720,"boxes":[],"file_url":"/mock/bag-none.jpg","model_version":"yolov8n-2026-06-20"}
]

alerts:
[
 {"id":"a1","time":"2026-10-10T12:15:47+07:00","kind":"mould","level":"red","title":"Likely mould on a bag","detail":"AI scan, 94% confidence","scan_id":"s3","resolved_at":null},
 {"id":"a2","time":"2026-10-10T09:12:00+07:00","kind":"climate","level":"amber","title":"Humidity below target","detail":"84.1% for 6 minutes, mister running","scan_id":null,"resolved_at":null},
 {"id":"a3","time":"2026-10-10T08:44:00+07:00","kind":"device","level":"grey","title":"Box did not report","detail":"No data for 3 minutes, back online at 08:47","scan_id":null,"resolved_at":"2026-10-10T08:47:00+07:00"}
]

systemStatus:
[{"name":"Grow box controller","status":"online","detail":"Last report 8 s ago"},{"name":"Temperature and humidity sensor","status":"ok","detail":"27.4 °C, 88%"},{"name":"Water tank","status":"ok","detail":"Level OK"},{"name":"Server (laptop)","status":"online","detail":""},{"name":"AI service","status":"ready","detail":"yolov8n, average 0.4 s"},{"name":"Database","status":"ok","detail":""},{"name":"Internet link","status":"connected","detail":""}]

Generate 24 hours of history at 5-minute steps for the chart from latestReading with gentle variation. Use the uploaded photos for file_url (bag-amber.jpg, bag-green.jpg, bag-red.jpg, bag-none.jpg). Show only healthy boxes faintly (thin green outline) and contaminated boxes clearly (amber or red by level, with a label chip).
```

### 5.4 Follow-up prompts (one at a time, after the first build)
```
Make the AI scan page work on a phone at 390px: photo full width, result card below, a sticky bottom bar with the two feedback buttons, and the gold "Take photo" button reachable with one thumb.
```
```
Add the phone bottom navigation: Overview, Climate, a raised round gold "Scan" button in the centre, Alerts, More. Hide the sidebar below 1024px.
```
```
Check every state on every page: loading skeletons, empty states, offline (grey), could-not-check (grey, never green), and the error "Can't reach the server". Show me a list of any state that is missing, then add them.
```
```
Polish pass: align all cards to the 8px grid, make reading numbers 52px semibold with tabular figures and muted 20px units, use a 1px #E4E1DA border on every card, and remove any shadow heavier than a soft 2px blur.
```
```
Fill src/i18n.ts "km" values from the Khmer list in the next message, and make sure Khmer labels never overflow their buttons or tiles (allow two lines in tiles).
```

---

## 6. Khmer labels (starting list, check every word)

Hout: please correct anything that reads unnaturally. These are a starting point only.

| English | Khmer |
|---|---|
| Overview | ទិដ្ឋភាពទូទៅ |
| Climate | អាកាសធាតុ |
| Alerts | ការជូនដំណឹង |
| Settings | ការកំណត់ |
| Temperature | សីតុណ្ហភាព |
| Humidity | សំណើម |
| Fan | កង្ហារ |
| Water tank | ធុងទឹក |
| Take photo | ថតរូប |
| Sign in | ចូល |
| Oyster mushroom | ផ្សិតស |
| Mister / AI scan / Likely mould / Please check / Could not check | (Hout to write) |

---

## 7. Review checklist (before showing anyone)

**Taste:**
- [ ] One primary action per screen. Gold appears only on AI elements.
- [ ] Numbers read from 3 metres away (the demo screen). Units are smaller and muted.
- [ ] Nothing decorative competes with status. No gradients, emoji or stock people.
- [ ] Phone screens work one-handed. The camera button is easy to reach.

**Truth:**
- [ ] CO2 says "Not measured", never a number. No harvest predictions.
- [ ] Grey "Could not check" never looks or reads like green.
- [ ] Confidence is shown as "74% confidence", next to "AI checks are suggestions".
- [ ] The fan "ventilates"; nothing claims the box cools.

**Works:**
- [ ] Every screen uses the field names in `docs/api-contract.md`.
- [ ] Mock mode runs with no backend. Switching to the real backend touches only `src/api/client.ts`.
- [ ] Take photo opens the rear camera on a real phone. Boxes line up with the photo.
- [ ] Manual override counts down and returns to Auto.
- [ ] Khmer toggle: no text overflow.
