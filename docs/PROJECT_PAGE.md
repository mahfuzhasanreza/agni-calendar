# Project page: Agni (team Dabanol)

> Copy-paste text for the NASA Space Apps 2026 **Project** tab. Section names and order follow the
> form fields in the 2026 Project Submission Guide. Everything must be in English. Every number
> comes from the pipeline output and docs/METHOD.md.

## Project Name
Agni: 25 years of fire history, one consistent calendar

## High-Level Project Summary
Satellites have mapped active fires for 25 years, but the record is split between NASA's MODIS
(since 2000) and VIIRS (since 2012), and VIIRS sees about five times more fires. Joined naively,
fire seems to explode in 2012. We built **Agni** (অগ্নি, "fire" in Bangla), a web app that
harmonizes both sensors into one record in VIIRS-equivalent units, validated by predicting every
overlap year from MODIS alone (held-out R² 0.95 on area totals). For any area in Bangladesh,
Northeast India and western Myanmar, land managers and responders get a 25-year burning calendar,
the fire season, "this month vs history" anomaly labels, a 3D fire map and downloadable evidence.
It matters because MODIS is ending: without harmonization, its 20 years of history become
unusable. In the Chittagong Hill Tracts the raw record says fire is increasing; the harmonized
record shows it is decreasing.

## Link to Project Demo
_(30-second video, public YouTube/Drive link, tested in a private window)_

## Link to Final Project
https://agni-calendar.vercel.app

## Detailed Project Description

**What it does.** Pick an area (preset, drawn polygon or rectangle, or latitude/longitude and
radius) and a date range. Agni shows:
- a year × month **burning calendar** (colorblind-safe viridis scale, table view),
- **raw vs harmonized** records: an animation morphs the raw record, with its 2012 jump, into the
  harmonized one, with uncertainty bands and a one-line check of the 2012 change,
- the **fire-season profile** (median and P10–P90 of 2003–2022 vs the selected year),
- **this month vs history**: value, median, percentile rank, ratio, robust z-score and a label
  (below normal / normal / above normal / extreme), with a link that opens the same day in
  **NASA Worldview** to check it against the satellite image,
- **annual totals** with a Sen's-slope trend and Mann–Kendall significance,
- a **3D fire map**: every 0.1° cell of the region as a column, played year by year from 2001;
  in raw mode the whole region "catches fire" in 2012, harmonized it does not,
- **CSV downloads** of every raw hotspot in the area (with the FIRMS acknowledgement and caveats)
  and of the monthly harmonized series,
- a hand-over to the **FIRMS Fire Map and email alerts** for live fires, shareable links, and a
  light / dark / device theme.

**How it works.**
1. Clean NASA FIRMS hotspots: vegetation fires only, MODIS confidence ≥ 30, VIIRS nominal/high;
   5.94 million detections from Nov 2000 to Nov 2026.
2. Grid them per 0.1° cell and month.
3. Calibrate MODIS → VIIRS S-NPP on the 2012–2025 overlap with four candidate models; the selected
   *local ratio* learns the VIIRS/MODIS ratio in each 1° tile and season.
4. Validate with leave-one-year-out cross-validation at four spatial levels. Selected model,
   held-out: 1° tile-month R² 0.952, error 21 %, bias −0.2 %; region-month R² 0.984.
5. Continue the record with NOAA-20 after S-NPP stopped (NASA: 2 November 2026; held-out R² 0.992),
   and scale the 2000–2002 Terra-only months with wider uncertainty.

**What we learned.** The VIIRS/MODIS ratio is not one number: about 3 in the jhum (shifting
cultivation) hills, where large burns are already visible to MODIS, and 6–8 in agricultural plains,
where many small fires are seen only by VIIRS (2.7–26 across 1° tiles). A single regional ratio
looked excellent on regional totals (R² 0.98) but overestimated the Chittagong Hill Tracts before
2012 by about 30 %. Validating at the size of a real user area exposed this, and the local ratio
fixed it: the harmonized change across 2012 now matches the MODIS-only change (×0.89 region-wide,
×0.88 vs ×0.89 in the Chittagong Hill Tracts), while the raw record jumps ×4.3.

**Benefits.** For land managers and fire responders in Bangladesh and Northeast India, Agni turns
two incompatible satellite records into one usable history: when the jhum burning season peaks,
whether a month is unusual, and whether burning is really rising or falling. In the Chittagong
Hill Tracts the raw record suggests a significant increase (+374 hotspots/year, 2003–2025,
p = 0.004), while the harmonized record shows a significant decrease (−470/year, p = 0.001).

**What we hope to achieve.** Keep 20 years of MODIS history usable after MODIS ends, give local
agencies an evidence base for fire-season planning, and extend the same pipeline to any region
(it is region-agnostic) and to NOAA-21.

**Limitations.** Fires too small for MODIS cannot be recovered: in rare-fire areas such as the
Sundarbans part of the 2012 step remains, so comparisons there should use the VIIRS era. Single
0.1° cells are much less certain than area totals; preset areas are approximate boxes.

**Tools.** Python (pandas, NumPy, SciPy, psycopg), TypeScript / Next.js, PostgreSQL + PostGIS
(Neon), Prisma, Vercel and Vercel Blob, MapLibre GL, ECharts, terra-draw, Tailwind CSS, GitHub
Actions; tests with pytest, Vitest and Playwright (including automated accessibility checks).
Source code: https://github.com/mahfuzhasanreza/agni-calendar

## Use of Super Intelligence (SI)
Yes. The idea, the product and the scientific approach (harmonizing MODIS onto VIIRS and
validating it) are our team's. We used **Claude Code** (Anthropic), an AI coding assistant, to
accelerate the build: it drafted the implementation plan from our specification, wrote most of the
code (data pipeline, calibration and validation, web app, tests, CI/CD) and documentation, and ran
checks against the data. We made every decision (method, scope, hosting), reviewed the work and
verified every reported number against the pipeline output. SI-assisted code is acknowledged in
the repository README, in docs/AI_USAGE.md (a dated log) and in the commit metadata
(Co-Authored-By lines). The app uses no SI at runtime, and no SI-generated images, video or audio
are used.

## NASA Data
- **FIRMS MODIS Collection 6.1 active fire** (Terra, Aqua), standard archive + near-real-time,
  Nov 2000 – Nov 2026.
- **FIRMS VIIRS 375 m Collection 2 active fire**, S-NPP (Jan 2012 – Nov 2026) and NOAA-20
  (Apr 2018 – Nov 2026), standard archive + near-real-time.
- **NASA Worldview** (Earthdata): linked from the app for each selected month (MODIS / VIIRS
  true-colour imagery with the matching fire layer).
- **FIRMS Fire Map and email alerts**: linked from the app for live monitoring.

Source: NASA Fire Information for Resource Management System (FIRMS),
https://www.earthdata.nasa.gov/data/tools/firms. We acknowledge the use of data and/or imagery
from NASA's Fire Information for Resource Management System (FIRMS)
(https://earthdata.nasa.gov/firms), operated by NASA's ESDIS project as part of LANCE.

NASA announced that Suomi NPP stopped delivering data on 2 November 2026 and directed users to
NOAA-20 and NOAA-21. Agni already continues the VIIRS reference with NOAA-20 (calibrated onto
S-NPP), so the record survives two sensor handovers: MODIS → VIIRS and S-NPP → NOAA-20.

Caveats (shown in the app and in every detections CSV): FIRMS data are provided "as is". A
hotspot is the centre of a ~1 km (MODIS) or 375 m (VIIRS) pixel containing one or more fires or
thermal anomalies, not the exact fire location; fires can be missed under cloud, smoke or canopy,
when small or cool, or between overpasses. Times are UTC.

## Space Agency Partner Data and Other References
**Space agency partner.** The challenge was created by CONAE (National Space Activities Commission
of Argentina) with NASA. No partner datasets are used; all fire data are NASA FIRMS.

**Scientific references.**
- Giglio, L., Schroeder, W., Justice, C. O. (2016). The collection 6 MODIS active fire detection
  algorithm and fire products. *Remote Sensing of Environment*, 178, 31–41.
  https://doi.org/10.1016/j.rse.2016.02.054
- Schroeder, W., Oliva, P., Giglio, L., Csiszar, I. (2014). The New VIIRS 375 m active fire
  detection data product: algorithm description and initial assessment. *Remote Sensing of
  Environment*, 143, 85–96. https://doi.org/10.1016/j.rse.2013.12.008
- Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. *JASA*, 63,
  1379–1389.
- Duan, N. (1983). Smearing estimate: a nonparametric retransformation method. *JASA*, 78, 605–610.

**Maps, fonts and icons.** Basemap: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors
(ODbL). Fonts: Geist and Geist Mono (Vercel, SIL Open Font License). Icons: Lucide (ISC).

**Open-source software** (all under open licences): Next.js, React, Prisma, PostgreSQL, PostGIS,
MapLibre GL JS, terra-draw, Apache ECharts, Tailwind CSS, shadcn/ui and Base UI, Zod, pandas,
NumPy, SciPy, psycopg, pytest, Vitest, Playwright, axe-core.

**Hosting.** Vercel (app and file storage), Neon (PostgreSQL), GitHub (code and CI).

**AI tool.** Claude Code (Anthropic), see *Use of Super Intelligence*.

**Demo video.** Screen recordings of our own app; no third-party music or images
_(list any music and its licence here if you add some)_.
