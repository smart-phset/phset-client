# SmartPhset user guide

For the team, demo presenters, and farmers trying the app. Live at **https://smartphset.vercel.app**.

SmartPhset helps oyster-mushroom farmers in two ways:
1. **Climate:** each grow room has a small controller that keeps humidity and temperature in range, using a
   mister and a fan.
2. **AI mould check:** you photograph a grow bag, and the AI marks areas that may be mould, so you can remove that
   one bag before the mould spreads.

> **AI checks are suggestions.** Always confirm by looking at the bag yourself.

---

## 1. Getting in

The first screen is **Sign in**.

| Option | When to use it |
|---|---|
| **Continue without an account** | Today. It is the main button at the top while team accounts are off. |
| **Username + password** | Later, once team accounts are switched on. Until then, signing in shows "Team accounts are not set up yet". |

- **Change the language first, if you like:** the **EN | ខ្មែរ** switch is at the top right of the sign-in screen.
- **Staying signed in:** you stay in for 14 days on that browser.
- **Signing in properly later:** open **Settings → Account → Sign in with an account**.

## 2. The screen layout

**On a computer:**
- **Left sidebar:** Overview, AI scan, Climate, Alerts, Scan history, System status and Settings. A red number on
  **Alerts** shows how many are open.
- **Top bar:**
  - The **room switcher**, with a coloured dot for each room's status.
  - **Demo data**, shown when no farm server is connected.
  - The live "updated N s ago" pill.
  - The **EN | ខ្មែរ** language switch.
  - Your account icon.

**On a phone:** a bottom bar with Overview, Climate, **Scan** (the gold button), Alerts and History.

**Status colours** (always shown with an icon and a word, never colour alone):

| Look | Meaning |
|---|---|
| Green, check icon | All good, or no mould seen |
| Amber, warning icon | Please check a bag, or check the climate |
| Red, alert icon | Likely mould: act now |
| Grey, eye-off or cloud-off icon | Could not check, or the room is offline. **Never** means healthy. |

## 3. Rooms

A farm has several grow rooms. The demo has three:

| Room | State in the demo |
|---|---|
| Room 1 | All good |
| Room 2 | One bag to check |
| Room 3 | Running warm, so the fan is ventilating |

- **Switch rooms** with the top-bar switcher, the room cards on Overview, or the tabs on Climate.
- **The app remembers the last room you chose** on that device.
- **Room-specific:** the readings, targets, manual controls and climate activity.
- **Shown for all rooms:** scan history and alerts, each labelled with its room, with a room filter.

## 4. Overview

- **All rooms strip:** one card per room with status, temperature, humidity and open alerts. Click a card to open
  that room.
- **Status card** for the chosen room: one plain sentence saying what is happening.
- **Last AI check:** the latest photo for the room, with its result. **Take photo** opens the AI scan.
- **Reading tiles:** temperature, humidity, fan, mister, water tank, and CO₂ (always "Not measured", because there
  is no CO₂ sensor).
- **Climate history:** in the demo this is a drawn trend. Real history appears once a room's controller is
  connected.
- **Recent alerts:** the three newest alerts from any room.

## 5. AI scan: checking a bag

1. Open **AI scan**, or tap the gold **Scan** button on a phone.
2. Choose the **Room** the bag is in.
3. **Take photo** opens the phone camera. On a computer, use **Upload from computer**.
4. Wait about 2 seconds while it says "Checking for mould".
5. Read the result.

**For a good photo:** one bag face filling the frame, 20–30 cm away, soft light, no flash glare. The full guide is
in **Settings → Camera setup guide**.

**Demo mode:** with no AI server connected, you see a **saved example**. It's a real bag photo with our model's real
result, not your own photo, and the screen says so.

### Reading a result

| Result | What it means | What to do |
|---|---|---|
| **Likely mould** (red) | The AI is 80% sure or more | Remove the bag now; check the bags next to it; press **Bag removed** or **Not mould** |
| **Please check this bag** (amber) | The AI is 40–79% sure | Look at the marked area; press **Mould confirmed, bag removed** or **Looks fine to me** |
| **No mould seen** (green) | The bags were recognised and nothing was flagged | Keep checking daily. A clear result is not a guarantee. |
| **Could not check** (grey) | No bag found, or the photo was dark or blurry | Take another, closer photo with more light |

**On the photo:**
- **Dashed outlines** are bags the AI recognised.
- **Solid outlines** with a label are possible mould, with the AI's confidence.

Pressing a feedback button **closes the matching alert** and updates the alert counts everywhere.

## 6. Alerts

- **Filters:** by type (Mould, Climate, Device), **Open** or **Resolved**, and **Room**.
- **Details:** click an alert to see the photo (for mould alerts), what to do, and buttons to resolve it or open the
  scan.
- **Resolving:** a mould alert can be resolved as "bag removed" or "false alarm".
- **Badges:** the red number on the sidebar or bottom bar counts open alerts across all rooms.

## 7. Climate

For the room you have chosen:
- **Readings:** temperature and humidity, plus the target band.
- **Targets:**
  - **Mister on below** and **Mister off at:** the humidity band, 85–90% by default.
  - **Ventilate above:** the temperature at which the fan runs, 30 °C by default.
  - Press **Save targets**. The room applies them within 30 seconds.
- **Manual control:**
  - Fan and mister each have **Auto | On | Off**.
  - On or Off lasts **10 minutes**, with a countdown, then returns to Auto by itself.
- **Water tank:** shows OK or Low. When it is low, the mister stops so it doesn't run dry.
- **Fan and mister activity:** a log of what switched and why.

> The fan ventilates toward the outside air temperature. **It cannot cool below it.**

## 8. Scan history

Every AI check in one grid:
- **Filter** by room and by result.
- **Click** a card to open the full result.
- **Red banner:** appears when a bag flagged as likely mould still needs your review.

## 9. System status

A health check of every part:
- **Per room:** the controller, its last report, temperature and humidity, and the water tank.
- **Shared parts:** the farm laptop (server), the AI and the internet link.

Press **Check again** to re-test. In demo mode the shared parts show "Not connected", which is expected.

## 10. Settings

- **Language:** English or Khmer.
- **Account:** guest or team; sign in or sign out.
- **Rooms:** list of rooms.
- **AI alert levels:** explained, with the measured accuracy.
- **Room hardware:** the parts in each room.
- **About:** version, model and photo credits.

## 11. Language

Switch with **EN | ខ្មែរ**: on the sign-in screen, in the top bar, or in Settings. The choice is remembered.

The Khmer text is a **first draft** being checked by our team. Some short labels and data still appear in English.

## 12. Honest limits (say these if asked)

- **The AI:**
  - It was trained on public photos of oyster grow bags and is **not yet validated on our farm**.
  - Measured on 752 public photos:
    - At the "please check" level it missed no mould but flagged 38% of healthy photos.
    - At the "likely mould" level it flagged 10% of healthy photos and missed 14 of 373 mould photos.
- **No CO₂ sensor:** this prototype doesn't have one.
- **The fan ventilates; it doesn't cool.**
- **In demo mode:**
  - Readings are simulated.
  - Scan results come from saved real examples.
  - Your changes are kept on that device for 12 hours. **Settings → Reset demo data** starts fresh.

## 13. Quick demo path (3 minutes)

1. **Sign-in:** "Continue without an account". Show the **EN | ខ្មែរ** switch.
2. **Overview:** "three rooms, one needs attention". Click **Room 2**.
3. **AI scan:** choose Room 2 and upload **`bag-red.jpg`** (from `public/mock/`). It shows "Likely mould 94%"
   with the box. Press **Bag removed**.
4. **Alerts:** the alert is now resolved, and the badge count has dropped.
5. **Climate:** set the mister to **On**, show the 10-minute countdown and the target band.
6. **Switch to ខ្មែរ:** the whole flow in Khmer.
