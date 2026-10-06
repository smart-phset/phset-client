# SmartPhset web assets

Everything in `public/` is served by Next.js from the site root. For example, `public/brand/logo-mark.svg` is
`/brand/logo-mark.svg`. Made on 2026-10-03.

## Brand (`public/brand/`)

| File | What | Use |
|---|---|---|
| `logo-full.svg` | Mark + wordmark, transparent, navy + circuit blue | Sign-in page, About |
| `logo-mark.svg` | Mushroom mark only, transparent | Sidebar (32 px), loading screen |
| `logo-full-white.svg`, `logo-mark-white.svg` | All-white versions | On navy or photo backgrounds only |
| `logo-full.png` (1160 × 912), `logo-mark.png` (512 × 512) | Transparent PNGs | Attach these in Stitch and Figma |
| `favicon.ico` (16, 32, 48 px) | Browser tab icon | Link it in the page `<head>` |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180) | App icons on white | Web app manifest, iPhone home screen |
| `og-image.png` (1200 × 630) | Link preview for chat apps and social media | `og:image` meta tag |

**Logo rules:**
- **Never redraw, stretch, recolour or put effects on the logo.** Use the SVG files.
- **Keep clear space around it** of at least the height of the "S" in the wordmark.
- **Minimum size:** the mark at 24 px, the full logo at 120 px wide. Below 24 px the circuit lines blur.
- **Colours** are sampled from the original: navy `#19325A`, circuit blue `#3383C7`.
- **Provenance:** traced to SVG on Oct 3 from the logo in the September judge deck. The original is a raster
  image (800 × 800).
- **Wordmark:** the letters look like Poppins SemiBold [unconfirmed]. Use the logo file, not live text.

## Mock scan photos (`public/mock/`)

**Real photos of oyster grow bags, with our AI model's real results** (`scans.json`). Run on Oct 3 with the
June model at confidence 0.4.

| File | Level | Real result |
|---|---|---|
| `bag-amber.jpg` (720 × 1280) | amber | 2 possible-mould areas, highest 74% |
| `bag-green.jpg` (1280 × 720) | green | 4 bags seen, no mould flagged |
| `bag-red.jpg` (720 × 1280) | red | 1 likely-mould area, 94% |
| `bag-none.jpg` (1280 × 720) | grey | No bag found (empty table) |

- **Use these for every AI-scan screen and mock.** Do not use generated images there: the boxes and
  percentages must be the AI's real output.
- **Box coordinates** in `scans.json` are in the photo's own pixels. Scale them by the displayed size
  divided by `width` and `height`.
- **Honest limit:** these are public dataset photos, not our farm. Our AI also found nothing in a real
  whole-room farm photo from the same dataset (it was trained on close-ups).

## Photos (`public/photos/`)

| File | What | Use |
|---|---|---|
| `oyster-fruiting-bag.jpg` (563 × 960) | Grey oyster mushrooms fruiting from a bag | Sign-in page, About |
| `oyster-cluster-white.jpg` (1201 × 1048) | Clean white oyster cluster on a dark background | Sign-in page alternative, empty states |

For more photos (grow-house scenes, hands taking a photo, and so on), see `docs/asset-image-prompts.md`.

## Icons

Use **Lucide** (lucide.dev, free) at 1.5 px stroke. Suggested names:

| Meaning | Lucide icon |
|---|---|
| Temperature | `thermometer` |
| Humidity | `droplets` |
| Fan | `fan` |
| Mister | `cloud-fog` |
| Water tank | `glass-water` |
| CO2 (not measured) | `wind`, greyed out |
| Take photo / AI scan | `camera`, `scan-line` |
| No mould seen | `circle-check` |
| Please check | `triangle-alert` |
| Likely mould | `octagon-alert` |
| Could not check | `eye-off` |
| Box offline | `wifi-off` |
| Alerts | `bell` |
| Climate | `gauge` |
| History | `images` |
| System status | `activity` |
| Settings | `settings` |

## Credits (keep these in the About page or the repo)

- **Grow-bag photos** (`public/mock/`): Roboflow Universe, "contamination-detection" dataset by the "Oyster
  Mushroom Fruiting Bag" workspace, **CC BY 4.0**, with credit required.
  https://universe.roboflow.com/oyster-mushroom-fruiting-bag/contamination-detection-ozkwx. Resized; boxes are
  our model's output.
- **`oyster-fruiting-bag.jpg`:** cropped from "Pleurotus pulmonarius of private cultivation.jpg", Wikimedia
  Commons, **Public Domain**.
- **`oyster-cluster-white.jpg`:** cropped from "कन्या च्याऊ.jpg", Wikimedia Commons, **CC0**.
- **Logo:** SmartPhset team.
