# Agni demo video (30 seconds)

Follows the **2026 Project Submission Guide**: the demo is **one video of 30 seconds or less**
(or a slide deck of at most 7 slides). **Over 30 s = not eligible for Global Judging**, so aim
for **27–28 s**. English voice-over (or another language **with English subtitles**). Host it
publicly (YouTube "Unlisted" or "Public", no login) and paste the link into *Link to Project Demo*.
Every number below is real and visible in the app.

The guide's timing: 0:00 who you are → 0:02 the challenge and why → 0:05 project name + tagline →
0:10 how it works, the user, the NASA data → 0:20–0:30 the future.

## Script

| Time | Screen (record each shot separately, cut together) | Voice-over (≈ 83 words) | On-screen text |
|---|---|---|---|
| 0:00–0:03 | Agni home page, header visible, with the **team card overlaid** on the lower third | "Hi, we're team Dabanol, from Bangladesh." | **Team Dabanol** · Name 1, *role* · Name 2, *role* · Name 3, *role* |
| 0:03–0:05 | Explorer, Chittagong Hill Tracts preset, map zooms in | "Every spring, the hills near my home burn." | *Harmonization of MODIS and VIIRS Hot Spots* |
| 0:05–0:10 | Scroll to "One record from two sensor families", mode **Raw**: the 2012 jump | "This is Agni: twenty-five years of fire history, one consistent calendar." | **Agni: 25 years of fire history, one consistent calendar** |
| 0:10–0:15 | Click **Replay**: the raw line morphs into the harmonized line | "In 2012, NASA's VIIRS sensor began seeing five times more fires than MODIS, faking a fire explosion. Agni calibrates MODIS onto VIIRS, and the jump disappears." | Raw ×3.05 → Harmonized ×0.88 |
| 0:15–0:20 | 3D fire map, **Raw**: slider 2011 → 2012 (region lights up); switch **Harmonized**, 2011 → 2012 | (continues) | NASA FIRMS · MODIS + VIIRS · 5.9 M hotspots |
| 0:20–0:25 | Burning calendar (Feb–Apr jhum season), then the "This month vs history" label, then click **Raw detections (CSV)** | "Draw any area: see its burning season, this month's anomaly, and download the evidence." | Calendar · Anomaly · CSV |
| 0:25–0:29 | Harmonized annual chart, then the **end card** (hold ≥ 2 s) | "So responders know if a fire season is truly unusual. When MODIS goes dark, its history lives on." | End card: **Agni** · agni-calendar.vercel.app · Team Dabanol: Name 1 · Name 2 · Name 3 · *NASA FIRMS data* |

Voice-over as one paragraph (read it aloud with a stopwatch; it must fit in 28 s):

> Hi, we're team Dabanol, from Bangladesh. Every spring, the hills near my home burn. This is Agni:
> twenty-five years of fire history, one consistent calendar. In 2012, NASA's VIIRS sensor began
> seeing five times more fires than MODIS, faking a fire explosion. Agni calibrates MODIS onto VIIRS,
> and the jump disappears. Draw any area: see its burning season, this month's anomaly, and
> download the evidence. So responders know if a fire season is truly unusual. When MODIS goes dark,
> its history lives on.

About 83 words ≈ 29 s at a brisk pace; check with a stopwatch. If it runs over 30 s, cut "faking a
fire explosion" first. The
challenge name is on screen at 0:02–0:05 (*Harmonization of MODIS and VIIRS Hot Spots*), so it
need not be spoken.

## Team card and end card (as built, 2026-11-15)

Team (from `team.txt`): Mahfuz Hasan Reza (Team Leader, Full-Stack Developer),
Jiyasmin Akter Sinthiya (Storyteller), Shadab Yasar (Data Analyst),
Md. Asaduzzaman Shuvo (Researcher). All members are adults.

- **Presenter on camera:** Sinthiya reads the script (5 clips + "Thank you"). Opening: "Team Dabanol ·
  Bangladesh" over a centred row of 4 boxes with full names and designations; her box holds her
  live video (she appears once, no separate photo). Her box then flies into a picture-in-picture
  corner while the app plays, and grows back to the centre for the closing line.
- **End card (no team info):** a browser window pops in, types https://agni-calendar.vercel.app and
  opens the app; chips: free, no login · any area · 25 years · CSV downloads · works on phones;
  "Data: NASA FIRMS (MODIS, VIIRS)". No NASA logo.
- **Subtitles:** one line at a time, black text (thin white edge), no background box.
  No subtitle for "Agni: twenty-five years…" (the title card shows it; only "This is") or for
  "Thank you!". No label chips at the top of the app shots.
- **Polish (v4):** team photos arrive within 0.7 s; an orange pulse ring marks the 2012 jump on the
  raw chart; the CSV shot zooms into the sensor / confidence columns; the end card builds in 1 s
  and holds to the last frame (no fade to black).
- Build: `~/projects/agni-video/build/prep_face.sh` then `python3 build/make_video.py`
  (ffmpeg + Pillow) → `agni-demo.mp4`, 28.8 s, 1080p, burned-in English subtitles, −16 LUFS.

## Recording checklist

- **Light theme** (header toggle ☀️), desktop browser ~1440 px wide, zoom 100 %, other tabs closed.
  Open https://agni-calendar.vercel.app once beforehand (wakes the database and CDN).
- Screen recorder at 1080p, 30 fps (OBS, or the OS recorder). Record each shot separately; cut in
  any editor (CapCut, DaVinci Resolve, Clipchamp).
- **Burn in English subtitles** for every line (judges often watch muted). Required if you speak
  any other language.
- Music: none, or royalty-free with a licence that allows it; list it in *References*.
- **No person under 18** may appear or be heard (Space Apps Terms). Showing your own face is
  optional; a voice-over is enough.
- **Super Intelligence (SI) rules:** an SI-generated voice, image or clip must carry a visible
  watermark / be disclosed. A screen recording of the app with your own voice needs none. Do not
  put NASA logos or branding into any generated content.
- Export MP4 (H.264), check the length is **≤ 0:30**, upload, open the link in a private window to
  confirm it plays without login.
