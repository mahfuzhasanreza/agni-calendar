# Project page draft: Agni

> Draft text for the NASA Space Apps 2026 project page. The section names follow previous
> Space Apps project pages; adjust them to the 2026 Project Submission Guide. Every number is
> taken from the pipeline output and docs/METHOD.md.

## Project name
Agni (অগ্নি: "fire" in Bangla and Sanskrit): 25 years of fire history, one consistent calendar.

## High-level summary
Satellites have mapped active fires for 25 years, but the record is split between MODIS (since
2000) and VIIRS (since 2012), and VIIRS sees about five times more fires. Joined naively, fire seems
to explode in 2012. Agni harmonizes the two into one record in VIIRS-equivalent units, validated by
leaving each overlap year out and predicting it from MODIS (held-out R² 0.95 on 1° tile-month
totals). On top of it, Agni gives land managers and responders a burning calendar for any area they
draw in Bangladesh, Northeast India and western Myanmar: which months burn, which years burned
most, how this month compares with 20 years of history, and the raw hotspots as CSV evidence. In the
Chittagong Hill Tracts, the raw record says fire is increasing; the harmonized record shows it is
decreasing.

## Links
- Live app: https://agni-calendar.vercel.app
- Method and live validation: https://agni-calendar.vercel.app/method
- Source code: https://github.com/mahfuzhasanreza/agni-calendar
- Demo video: _(add link)_

## Project details

**What it does.** Pick an area (preset, drawn polygon or rectangle, or latitude/longitude and
radius) and a date range. Agni shows:
- a year × month **burning calendar** (colorblind-safe viridis scale, table view),
- **raw vs harmonized** annual records with uncertainty bands, and a one-line check of the 2012 change,
- the **fire-season profile** (median and P10–P90 of 2003–2022 vs the selected year),
- **this month vs history**: value, median, percentile rank, ratio, robust z-score and a label
  (below normal / normal / above normal / extreme),
- **annual totals** with a Sen's-slope trend and Mann–Kendall significance,
- **CSV downloads** of every raw hotspot in the area and of the monthly harmonized series,
- shareable links that reopen the same view.

**How it works.**
1. Clean NASA FIRMS hotspots: vegetation fires only, MODIS confidence ≥ 30, VIIRS nominal/high;
   5.94 million detections from Nov 2000 to Nov 2026.
2. Grid them per 0.1° cell and month.
3. Calibrate MODIS → VIIRS S-NPP on the 2012–2025 overlap with four candidate models; the selected
   *local ratio* learns the VIIRS/MODIS ratio in each 1° tile and season.
4. Validate with leave-one-year-out cross-validation at four spatial levels. Selected model,
   held-out: 1° tile-month R² 0.952, error 21 %, bias −0.2 %; region-month R² 0.984.
5. Continue the record with NOAA-20 after S-NPP stopped on 1 November 2026 (held-out R² 0.992), and
   scale the 2000–2002 Terra-only months with wider uncertainty.

**What we learned.** The VIIRS/MODIS ratio is not one number: about 3 in the jhum (shifting
cultivation) hills, where large burns are already visible to MODIS, and 6–8 in agricultural plains,
where many small fires are seen only by VIIRS (2.7–26 across 1° tiles). A single regional ratio
looked excellent on regional totals (R² 0.98) but overestimated the Chittagong Hill Tracts before
2012 by about 30 %. Validating at the size of a real user area exposed this, and the local ratio
fixed it: the harmonized change across 2012 now matches the MODIS-only change (×0.89 region-wide,
×0.88 vs ×0.89 in the Chittagong Hill Tracts), while the raw record jumps ×4.3.

**Impact.** For land managers and fire responders in Bangladesh and Northeast India, Agni turns two
incompatible satellite records into one usable history: it shows when the jhum burning season
peaks, whether a month is unusual, and whether burning is really rising or falling. In the
Chittagong Hill Tracts the raw record suggests a significant increase (+374 hotspots/year,
2003–2025, p = 0.004), while the harmonized record shows a significant decrease (−470/year,
p = 0.001).

**Limitations.** Fires too small for MODIS cannot be recovered: in rare-fire areas such as the
Sundarbans part of the 2012 step remains, so comparisons there should use the VIIRS era. Single
0.1° cells are much less certain than area totals; preset areas are approximate boxes.

**Tools.** Python (pandas, NumPy, psycopg), Next.js / TypeScript, PostgreSQL + PostGIS (Neon),
Vercel and Vercel Blob, MapLibre GL, ECharts, Prisma, GitHub Actions; tests with pytest, Vitest and
Playwright (including automated accessibility checks).

## NASA data
- **FIRMS MODIS Collection 6.1 active fire** (Terra, Aqua), standard archive + near-real-time,
  Nov 2000 – Nov 2026.
- **FIRMS VIIRS 375 m Collection 2 active fire**, S-NPP (Jan 2012 – Nov 2026) and NOAA-20
  (Apr 2018 – Nov 2026), standard archive + near-real-time.

Source: NASA Fire Information for Resource Management System (FIRMS),
https://firms.modaps.eosdis.nasa.gov/.

## Space agency partner and other data
- Challenge by CONAE (Argentina) with NASA.
- Basemap: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors (display only).

## Use of Artificial Intelligence
The software was built with **Claude Code** (Anthropic), an AI coding assistant, working with our
team: it drafted the implementation plan, wrote most of the code (data pipeline, calibration and
validation, web app, tests, CI/CD) and the documentation, and ran checks against the data. The
team set the goals and the product, made the decisions (method, hosting, scope), reviewed the work
and owns the results. During validation the AI flagged problems that changed the method (the
spatially varying VIIRS/MODIS ratio, over-wide uncertainty bands) and every reported number was
checked against the pipeline output. Agni itself uses no AI at runtime: all values shown come from
NASA FIRMS data processed by the documented pipeline. A dated log is in
[docs/AI_USAGE.md](AI_USAGE.md).

## References
- Giglio, L., Schroeder, W., Justice, C. O. (2016). The collection 6 MODIS active fire detection
  algorithm and fire products. *Remote Sensing of Environment*, 178, 31–41.
- Schroeder, W., Oliva, P., Giglio, L., Csiszar, I. (2014). The New VIIRS 375 m active fire detection
  data product: Algorithm description and initial assessment. *Remote Sensing of Environment*, 143,
  85–96.
- Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. *JASA*, 63,
  1379–1389.
- Duan, N. (1983). Smearing estimate: a nonparametric retransformation method. *JASA*, 78, 605–610.
