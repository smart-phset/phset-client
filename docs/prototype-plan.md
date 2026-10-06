# SmartPhset prototype plan (Oct 2026)

> For: Hout and the hardware engineer. Goal: a working prototype at the National Challenge, **Oct 23-25, 2026**.
> Agreed at the Oct 3 meeting.
> - Hout builds the website, login and Vercel hosting.
> - The engineer builds the Node.js REST backend, the hardware, and the wiring that joins them.
>
> Background detail: the team research folder (prototype-stack-research-2026-10.md).

## 1. Who does what

| Hout | Engineer | Together |
|---|---|---|
| Website (pages, dashboard, camera page) | Node.js REST API on the laptop | Agree the API contract (section 3) |
| Basic login | Postgres / Redis / image storage | Weekly integration test |
| Vercel + GitHub hosting (Hout's own accounts; engineer added as a collaborator) | ESP32, sensor, fan, mister, power | Demo rehearsal |
| Keep the AI service (`bridge.py`) running | Connect the backend to the AI | |

## 2. How it fits together

```
 PHONE (camera) --> WEBSITE on Vercel --> tunnel --> LAPTOP: Node API --> Postgres / images
                                                           |
                                                           +--> AI (bridge.py, Python, local)
 GROW BOX: ESP32 + temp/humidity sensor + fan + mister --Wi-Fi--> LAPTOP: Node API
```

- **ESP32:**
  - Reads temperature and humidity, and switches the fan and mister **itself**.
  - Sends readings to the laptop every ~30 s, so the box keeps working even if the laptop or Wi-Fi drops.
- **Laptop:** stores readings and photos, and asks the AI about each photo.
- **Website:** shows the readings and AI results, and sends phone photos in.
- **Tunnel:** the website is served over HTTPS, and an HTTPS page cannot call a plain `http://` address on
  the local network, even on the same Wi-Fi (browsers block "mixed content"). A tunnel program (Cloudflare
  Tunnel or ngrok) gives the laptop a public HTTPS address.
- **Forwarding:** the website's own server on Vercel forwards each call to the tunnel, adding the API key.
  Three benefits:
  - The browser never sees the key or the tunnel address.
  - No CORS setup is needed on the laptop.
  - One login protects everything.
  - (If the browser called the laptop directly instead, the laptop API would have to answer CORS for our
    Vercel domain.)
- **Offline backup:** the website served from the laptop itself (`npm start`) or `bridge.py`'s own page. Do
  not point the Vercel site at the laptop's local address; the browser blocks it. Keep a plain "take photo"
  button (`<input type="file" capture>`) on the camera page: a live camera preview needs HTTPS, so it will not
  open on the offline backup.

## 3. What to agree first: the API contract

A short shared file in the GitHub repo. The engineer owns the backend, so he has the final say on the details.
A starting point:

| Endpoint | Used by | For |
|---|---|---|
| `POST /telemetry` | ESP32 | Send a reading; the reply can carry targets and overrides |
| `GET /readings/latest`, `GET /readings?from=&to=` | Website | Live numbers and charts |
| `POST /images` | Website | Upload a phone photo; reply = AI result |
| `GET /images`, `GET /alerts` | Website | Recent photos, alerts |
| `PUT /devices/{id}/settings` | Website | Targets, manual fan/mist override |

Two example shapes, so Hout can build with placeholder data now:

```json
{"device": "esp32-1", "temp_c": 27.4, "rh": 88.2, "fan_on": true, "mist_on": false, "co2_ppm": null}
```
```json
{"id": "b7c1", "verdict": "contamination_suspected", "level": "amber",
 "max_contaminated_conf": 0.62, "boxes": [{"label": "contaminated", "conf": 0.62, "xyxy": [135, 560, 803, 943]}]}
```

- `co2_ppm` stays `null`, because there is no CO2 sensor; the website shows "not measured".
- `verdict` has four values:
  - `contamination_suspected`.
  - `no_contamination_seen`.
  - `no_detection` and `camera_error`. Both mean **"could not check"** and must never be shown as healthy.
- Agree the name of the key header too, for example `Authorization: Bearer <key>`.

## 4. Dates

| By | Hout | Engineer | Check together |
|---|---|---|---|
| **Oct 4-5** | Repo, Vercel site with login, placeholder data | Parts ordered, backend skeleton | Contract agreed |
| **Oct 9** | Phone photo -> AI result shown on the live site (`bridge.py` through a tunnel) | ESP32 readings arriving on the laptop | Both work on their own |
| **Oct 15** | Website switched from placeholder to the real backend | Backend + AI + photos joined; fan and mister wired and responding | **Full loop works** |
| **Oct 19** | Demo flow polished; offline backup | Wet test and 24-hour run | Fault tests pass; AI checked on the exact bags and photos we will use on stage |
| **Oct 20-22** | Freeze features, rehearse, record a backup video | Pack the demo kit and spares | Demo runs twice in a row |

## 5. Heads-ups from the research (for us to decide together)

1. **MinIO:** its free version is no longer maintained (repo archived Apr 2026, official Docker image gone).
   - A folder of images on the laptop is enough for one box.
   - If he wants an S3-style store, there is a community fork (`pgsty/minio`) or SeaweedFS.
2. **Redis** is optional for one box. It could be added after the full loop works.
3. **The tunnel needs its own password (API key).** The Vercel login does not protect the laptop's public
   address.
   - Quick Tunnel's address changes on every start.
   - ngrok's free plan has a fixed address, but caps traffic at 20,000 requests and 1 GB **a month**. The
     build and the demo would share October's allowance.
   - So: Quick Tunnel during the build, and save a fixed address for the demo.
4. **Vercel:**
   - Forwarded requests are capped at 4.5 MB, so phone photos are shrunk in the browser first (to about
     1280 px).
   - The free Hobby plan is "non-commercial only". Ask Vercel, or pay for Pro ($20) for October.
5. **The AI stays Python.** The Node backend calls `bridge.py` on the laptop (`POST /image`, raw JPEG).
   - Use `max_contaminated_conf` for alerts.
   - Two levels, because the model flags many healthy bags. Measured Oct 3 on 752 public validation
     photos, not farm-tested:
     - Amber from 0.4: no mould missed, 38% of healthy photos flagged.
     - Red from 0.8: 14 of 373 mould photos missed, 10% of healthy photos flagged.
     - Details are in the [SmartPhset-AI](https://github.com/menghoutishere-code/SmartPhset-AI) repo
       (`evidence/threshold-check-2026-10-03.md`), with the bridge code and the model.
6. **Hardware tips:**
   - Choose an SHT4x-type humidity sensor; DHT22 struggles at 85-95% humidity.
   - Avoid IRF520 MOSFET modules, which barely switch at the ESP32's 3.3 V.
   - The ESP32 only joins 2.4 GHz Wi-Fi, so bring our own hotspot to the venue.
   - A fan can't cool below room temperature.
7. **Later, not now:** the YOLO model's licence (AGPL) matters if we sell the product. Judges may ask.

## 6. Open questions

1. Which laptop is the server? (The AI setup has to be copied there if it is the engineer's.)
2. Which tunnel, and do we want a fixed address for the demo?
3. Do we keep MinIO and Redis, or start simpler?
4. Which parts are bought, from where, and by when?
