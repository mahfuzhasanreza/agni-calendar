# Agni demo script

Two cuts: **30 seconds** (if the 2026 rules ask for a short video) and **~2 minutes** (full
walkthrough). Check the length and format limits in the 2026 Project Submission Guide before
recording. All numbers are real and appear on screen in the app.

**Before recording:** open https://agni-calendar.vercel.app once (wakes the database), use a
desktop browser at ~1440 px wide, light or dark mode consistently, and close other tabs.

---

## 30-second cut

| Time | Screen | Voice-over |
|---|---|---|
| 0–6 s | Explorer, CHT preset, **Raw** selected, scroll to "One record from two sensor families" | "Satellites have watched fires for 25 years, but in 2012 the sensor changed, and the record suddenly shows three times more fire." |
| 6–14 s | Click **Replay** on the chart (raw jump morphs into the harmonized line), then **Harmonized**; point at the readout "raw ×3.05 · harmonized ×0.88 · MODIS alone ×0.89" | "Agni converts the old MODIS years into today's VIIRS units, validated year by year. The fake jump disappears." |
| 14–22 s | Scroll to "Annual totals and trend" | "And the conclusion flips: in the Chittagong Hill Tracts, burning is not increasing, it is decreasing by about 470 hotspots a year." |
| 22–30 s | Scroll up to "This month vs history", then click **Raw detections (CSV)** | "Any area, any month against 25 years of history, with the evidence one click away. Agni: when MODIS goes dark, its history lives on." |

---

## ~2-minute cut (follows CLAUDE.md §11)

### 1. The problem (0:00–0:20)
- Screen: Explorer → **Chittagong Hill Tracts** preset → switch to **Raw** → hero chart.
- Say: "NASA's MODIS satellites have recorded fires since 2000; VIIRS since 2012. VIIRS sees about five times more fires, because its pixels are smaller. Joined naively, fire seems to explode in 2012: three times more in the hills of Chittagong."

### 2. Harmonize (0:20–0:45)
- Screen: on "One record from two sensor families", click **Replay**: the raw line holds for ~1 s with its 2012 jump, then morphs into the harmonized record while the P10–P90 band fades in (it also plays once when the chart first scrolls into view). Then click **Harmonized** in the mode toggle (season and annual charts animate to the new values) and point at the readout under the chart title.
- Say: "Agni learns, in each one-degree tile and season, how many VIIRS fires one MODIS fire corresponds to, using 14 years when both satellites flew. The jump disappears: the harmonized change matches what MODIS alone sees, ×0.88 vs ×0.89."
- Then open **Method** in the header: point at the table (local ratio R² 0.952) and the held-out chart.
- Say: "We test it honestly: every year is predicted by a model that never saw it. Held-out R² 0.95 on tile totals. And we found that the ratio depends on the kind of fire: about 3 in the jhum hills, 6 to 8 in the plains."

### 2b. Optional 3D beat (≈10 s, if the video has room)
- Screen: mode **Raw** → "25 years of fire in 3D" → **Open the 3D fire map** → drag the Year slider from 2011 to 2012: the whole region lights up (39k → 212k hotspots). Switch the mode to **Harmonized** and repeat: 2011 and 2012 look alike (193k → 216k).
- Say: "In raw data the whole region seems to catch fire in 2012. It didn't; the satellite changed. Harmonized, the 25 years line up."

### 3. The burning calendar (0:45–1:10)
- Screen: back to Explorer → scroll to **Burning calendar**; hover a March cell.
- Say: "Twenty-five years, one row per year: the jhum burning season every February to April, in one consistent unit. Hatched cells are the least certain early years, and every chart has a table and a source note."
- Optional: **Draw → Rectangle** over Mizoram to show any area works in about a second.

### 4. This month vs history (1:10–1:30)
- Screen: "This month vs history" card; pick a month (e.g. March 2024) in **Month to compare**.
- Say: "For responders: this month against the same month in twenty years of baseline. Percentile, ratio to median, and a clear label: below normal, normal, above normal or extreme."
- Optional: **Sundarbans** preset: "In a protected mangrove forest, any fire is an anomaly."

### 5. Evidence (1:30–1:45)
- Screen: "Download the evidence" → click **Raw detections (CSV)** and **Monthly harmonized series (CSV)**; show the file opening.
- Say: "Every hotspot behind the numbers, with sensor, confidence and fire power, ready for a report."
- Optional (if time): scroll to "Live fires and alerts": "For fires burning right now, Agni hands you over to NASA FIRMS: the live Fire Map, or an email alert for this exact area." Extra line for the method: "S-NPP went dark on 2 November 2026; Agni already continues with NOAA-20, so the record has survived two sensor handovers."

### 6. Close (1:45–2:00)
- Screen: Annual totals and trend (CHT harmonized, −470/year), then the Agni header.
- Say: "The raw record said fire was increasing here; the harmonized record says it is decreasing. When MODIS goes dark, its twenty years of history live on. Agni."

---

## Backup plan

- If the live site is slow on first load: reload once (the database wakes in ~1 s); presets are cached.
- If Wi-Fi fails: run locally (`pnpm db:up`, `pnpm start`) with the full data already loaded.
- Screenshots of every step: `docs/screenshots/` (take them right after the final deploy).
