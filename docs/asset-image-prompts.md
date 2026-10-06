# SmartPhset: image-generation prompts for website assets

Prompts for photos and illustrations that look like **our farmers' oyster-mushroom rooms**. They work with any
image generator (Gemini/Imagen, ChatGPT images, Midjourney, Firefly), and with Stitch's own image generation.

**Best accuracy:** attach a real photo of a farmer's room as a reference image, and add "match the room in the
reference photo". Our own farm-visit photos beat any description.

## Three honesty rules

1. **Never use a generated image on an AI-scan screen.** Scan screens use the real photos and real results in
   `public/mock/`.
2. **Never present a generated image as our farm, our prototype or a real customer.**
   - Use them for the sign-in page, About, empty states and onboarding.
   - Caption one "Illustration" if someone could mistake it for evidence.
3. **Don't generate mould for teaching.** Use the real dataset photos to show what mould looks like.

## What our farmers' rooms look like

Paste this into any scene prompt:

- **The room:** an enclosed grow room, not an open hut.
  - Walls of brick, concrete, or wood and metal sheet, with a small door.
  - A concrete or packed floor, often damp.
  - Dim, diffused light from a doorway or small window.
  - Humid air with faint haze.
- **The bags:**
  - Cylindrical plastic grow bags filled with pale sawdust substrate, covered in white mycelium.
  - Each neck has a plastic collar ring, often blue or white, sometimes with a cap.
- **How bags are arranged:** **stacked on their sides in tall walls** or on shelves, from floor to above head
  height, necks facing the aisle. There are rows of these bag walls with narrow aisles between them.
- **The mushrooms:** clusters of white-to-light-grey oyster mushrooms (Pleurotus), fan-shaped and overlapping,
  growing out of the bag necks. Not every bag fruits at once, so the walls are mostly white bag ends with
  scattered clusters.
- **The work:** hand misting with a sprayer or hose, plastic water drums, simple tools.

**Avoid:**
- Bamboo huts, palm-leaf roofs, bags hanging outdoors.
- Western high-tech farms, stainless steel, purple LED lights, lab coats.
- Cartoon mushrooms; straw, button or shiitake mushrooms; mushrooms in soil.
- Text, logos, recognisable faces.

**Negative line**, for tools that accept one:
```
no text, no logos, no watermark, no bamboo hut, no palm-leaf roof, no lab coats, no stainless steel, no purple LED lights, no cartoon, no straw mushrooms, no button mushrooms, no shiitake, no distorted hands
```

---

## Prompts

### 1. Sign-in hero: the grow room (portrait 4:5, or tall 9:16 for the left panel)
```
Documentary photograph inside an enclosed oyster-mushroom grow room on a small farm in Cambodia. Tall walls of cylindrical plastic grow bags filled with white mycelium are stacked on their sides from floor to ceiling on both sides of a narrow aisle, each bag neck fitted with a blue plastic collar ring facing the aisle. Clusters of white-to-light-grey fan-shaped oyster mushrooms grow from many of the bag necks. Damp concrete floor, dim soft light from the doorway at the far end, humid air with a faint haze. Calm, clean, honest, natural colours, eye level, 35mm lens. No people.
```

### 2. Close-up: a wall of bag necks (square 1:1)
```
Close-up documentary photograph of a wall of oyster-mushroom grow bags stacked on their sides in a grow room: rows of white mycelium-covered bag ends with blue plastic neck collars, a few fresh clusters of white fan-shaped oyster mushrooms growing from the necks. Soft diffused light, slight condensation on the plastic, natural colours, sharp detail, no text.
```

### 3. Fruiting cluster (landscape 3:2) for About and empty states
```
Documentary photograph of one fresh cluster of white-to-light-grey oyster mushrooms with overlapping fan-shaped caps, growing out of the blue plastic collar of a grow bag in a wall of stacked bags. Soft side light, small water droplets on the caps, the rest of the bag wall softly blurred behind. Natural colours, crisp gills, no text.
```

### 4. Hands taking a photo of a bag (portrait 4:5) for the "How to take a good photo" onboarding
```
Documentary photograph, over-the-shoulder view: a farmer's hands holding a smartphone close to one bag in a wall of stacked oyster-mushroom grow bags inside a dim grow room, framing a single bag end so it fills the phone screen. The phone screen shows the camera view of the bag, no interface text. Only hands and forearms visible, no face. Soft diffused light, humid, natural colours.
```

### 5. Hand-misting routine (landscape 16:9) for About and the "Why SmartPhset" story
```
Documentary photograph inside an enclosed oyster-mushroom grow room: a grower seen from behind, in a long-sleeved shirt, hand-spraying a fine mist over walls of stacked grow bags with blue neck collars and white oyster mushroom clusters. Damp concrete floor, a plastic water drum and a hose, dim light from the doorway, fine droplets visible in the air. Calm, respectful, realistic, no face visible.
```

### 6. Fresh harvest (landscape 3:2) for About
```
Documentary photograph of freshly harvested white and light-grey oyster mushrooms in a plastic basket on a table just outside a grow room door, morning light, natural colours, appetising and realistic, no text, no price signs.
```

### 7. Empty-state line illustrations (square 1:1, white background)
For "No open alerts", "No scans yet" and "Box offline". Navy line art in the logo style.
```
Minimal line illustration on a plain white background: the end of one cylindrical grow bag with a collar ring and a small cluster of three oyster mushrooms growing from it. Single-weight navy (#19325A) strokes, rounded line ends, no fill, a few tiny circuit-style dots and short lines in blue (#3383C7) inside the gills. Lots of empty space, centred, flat, no text, no shading, no gradients.
```
Variants, changing the subject only:
- **No scans yet:** "a smartphone outline aimed at the bag end".
- **Box offline:** "a small closed plastic grow box with an unplugged cable".
- **No alerts:** "the mushroom cluster with a small check mark in a circle".

### 8. Grow-box concept (landscape 4:3), captioned "Concept"
Use this only until the real prototype exists, then replace it with a real photo.
```
Clean product concept photograph on a light warm-grey background: a clear plastic storage tote used as a small mushroom grow box, two cylindrical grow bags with white mycelium and blue neck collars inside, a small white electronics box on the outside, a small black fan in the side wall, a thin humidity sensor probe inside, and a small water bottle connected to a mist maker. Simple, honest, tidy DIY build, soft studio light, no text, no logos.
```

---

## After generating

- **Check against a real farm photo:**
  - An enclosed room with stacked bag walls.
  - Collars facing out.
  - Oyster-shaped clusters.
  - Normal hands.
- **Export:** 2x the display size, WebP or JPEG at quality 80, into `public/photos/` with plain names.
- **Record each image in `docs/assets.md`:** tool, date, prompt number, and "Generated".
