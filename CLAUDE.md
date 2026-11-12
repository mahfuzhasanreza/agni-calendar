# CLAUDE.md — AgniCalendar (NASA Space Apps Challenge 2026)

> Project context for Claude Code. Read this whole file before planning or writing code.
> Keep it updated as decisions change (it is the team's single source of truth).

---

## 1. The competition

- **Event:** NASA International Space Apps Challenge 2026, hackathon weekend **14–15 November 2026**.
- **Team goal:** reach Global Finalist and win a Global Award (targets: *Best Use of Data*, *Best Use of Technology*, *Local Impact*).
- **Judging criteria (all equally important):**
  1. **Impact** – real-world value for fire managers / responders.
  2. **Creativity** – originality of the solution.
  3. **Validity** – is it scientifically sound? Does it work in the real world?
  4. **Relevance** – does it answer the challenge and use NASA data?
  5. **Presentation** – clarity of the demo, video, and project page.
- **Lesson from 2025 finalists:** many polished data dashboards reached the finals, but only one won. The winners showed a *defensible method* plus a *clear user* plus *one memorable output*. Our differentiator is the **scientific harmonization method, proven with a before/after chart**, not the UI alone.
- **AI disclosure:** every project page has a "Use of Artificial Intelligence" section. We disclose that the codebase was built with Claude Code. Keep a short running log in `docs/AI_USAGE.md`.

## 2. The challenge: "Harmonization of MODIS and VIIRS Hot Spots"

Author: CONAE (Argentina's space agency), with NASA. Difficulty: Advanced/Intermediate.

**Problem:** Satellites have detected active-fire hotspots for 20+ years, but the record is split across two sensor families that cannot be compared directly:

| | MODIS (Terra, Aqua) | VIIRS (Suomi-NPP, NOAA-20, NOAA-21) |
|---|---|---|
| Record starts | Nov 2000 (Terra), Jul 2002 (Aqua) | Jan 2012 (S-NPP), later for NOAA-20/21 |
| Fire pixel size | ~1 km | 375 m |
| Sensitivity | Misses small/cool fires | Detects many more small fires |
| Status | Near end of mission life | The continuity sensor |

Raw counts jump when you switch sensors, so a naive 2000→today chart shows a fake "fire explosion" around 2012. MODIS is ending, so without harmonization ~10+ years of history becomes unusable.

**What the brief asks for:**
1. **Phase 1 – Harmonization:** combine MODIS and VIIRS so the sensor of origin no longer matters; focus shifts to patterns, trends, anomalies.
2. **Phase 2 – Web application:** user selects a region (draw on map **or** enter lat/lon) and a date range, then views and downloads analytics.
3. **Burning activity calendar:** hotspot counts from the early 2000s to the present: which months burn most, which years had most activity, how a current fire/month compares with history.
4. **Anomalies vs multi-year averages/medians**, e.g. current month vs historical median.
5. **Accessible color ramps** (colorblind-safe).
6. **Downloadable CSV** of hotspots found in a search.
7. **Users:** early-warning & emergency responders, scientists, land managers, firefighters.

## 3. Our product: **AgniCalendar** (working name)

> *"Twenty-five years of fire history, one consistent calendar."*

A web app that turns 25 years of MODIS + VIIRS hotspots into a **single, sensor-independent burning calendar** for any area of interest, with anomaly alerts and downloadable evidence.

### 3.1 Focus region (keeps data small and gives a Local Impact story)

- **Primary region:** Bangladesh + Northeast India + western Myanmar, bbox approx. **lon 86–97, lat 20–28**.
- **Hero stories for the demo:**
  - **Chittagong Hill Tracts (Bangladesh):** jhum (shifting cultivation) burning season, typically Feb–Apr.
  - **Northeast India hills** (Mizoram/Manipur/Tripura): same jhum regime, larger scale.
  - **Sundarbans:** protected mangrove forest; fires are rare, so any hotspot is an anomaly worth flagging.
- The pipeline must be region-agnostic so judges can draw any area *inside the loaded bbox*. (Stretch: add a second region, e.g. Argentina's Córdoba hills, as a nod to the challenge authors.)

### 3.2 Core user stories (MVP — must ship)

1. As a **land manager**, I draw a polygon (or enter lat/lon + radius, or pick a preset) and a date range, and see a **year × month calendar heatmap** of harmonized hotspot activity.
2. I see the **fire season profile**: monthly median with P10–P90 band, with the selected year overlaid.
3. I see **"this month vs history"**: current/selected month count, historical median, percentile rank, and an anomaly label (Below normal / Normal / Above normal / Extreme).
4. I see **annual totals** across the full record with a trend line.
5. I can **download a CSV** of the raw detections in my AOI and date range (with sensor, confidence, FRP, date/time), and a CSV of the monthly harmonized series.
6. I can toggle **Raw vs Harmonized** to see the 2012 sensor jump disappear (this is the "wow" moment of the demo).
7. A **Method page** explains the harmonization in plain language with the validation chart and metrics.

### 3.3 Stretch features (only after MVP is green and deployed)

- **Near-real-time:** nightly scheduled ingestion of the latest VIIRS NRT data via the FIRMS API, so "this month" is live.
- **Anomaly watchlist:** top cells in the region currently burning above their historical P90.
- **Shareable link:** AOI + date range encoded in the URL.
- **PNG export** of the calendar for reports.
- **Bangla UI toggle** (Local Impact).
- Second region (Argentina).

### 3.4 Out of scope

User accounts/auth, burned-area products, fire spread prediction, mobile app.

## 4. Data

### 4.1 Source: NASA FIRMS (Fire Information for Resource Management System)

- **Archive download (bulk, historical):** FIRMS "Archive Download" page, request by country or custom bbox, CSV format. Requests are emailed when ready, so **request them before the hackathon**.
  - MODIS Collection 6.1 standard product (Terra + Aqua), 2000 → present.
  - VIIRS S-NPP 375 m standard product, 2012 → present.
  - (Optional) VIIRS NOAA-20 / NOAA-21.
- **API (recent / NRT data):** FIRMS area API with a free `MAP_KEY` (rate-limited). Used for the nightly job. Verify the current endpoint format and limits in the FIRMS API docs before coding against it.
- Store `FIRMS_MAP_KEY` only in env / GitHub Secrets. Never commit it.

### 4.2 Fields we use (verify against actual CSV headers)

- Both: `latitude, longitude, acq_date, acq_time, satellite, confidence, frp, daynight, type` (+ `version`, `instrument`).
- MODIS: `brightness`, `bright_t31`, `confidence` is **0–100**.
- VIIRS: `bright_ti4`, `bright_ti5`, `confidence` is **l / n / h** (low/nominal/high).
- `type` (archive only): 0 = presumed vegetation fire, 1 = active volcano, 2 = other static land source (industry, gas flares), 3 = offshore.

### 4.3 Raw data placement

- Raw CSVs go in `data/raw/` (git-ignored). Commit only a **small sample** to `data/sample/` for tests and CI.

## 5. Harmonization method (the scientific core — Validity)

The method must be simple enough to explain in 60 seconds, documented in `docs/METHOD.md`, and validated with numbers.

1. **Clean**
   - Keep `type = 0` (vegetation fires) only; drop static industrial sources and volcanoes.
   - Confidence filter: MODIS `confidence ≥ 30`; VIIRS `confidence ∈ {n, h}`.
   - Normalize schema into one table with a `sensor` column (`MODIS_T`, `MODIS_A`, `VIIRS_SNPP`, `VIIRS_N20`, `VIIRS_N21`).
2. **Grid**
   - Assign each detection to a regular grid cell (default **0.1°**, configurable; 0.25° fallback if data is sparse).
   - Aggregate per `cell × month × sensor`: `detections` (raw count) and `fire_days` (distinct days with ≥1 detection). Fire-days are less sensitive to pixel size, so they harmonize better.
3. **Consistent reference sensors**
   - MODIS reference: Terra + Aqua combined **from Jul 2002**. For Nov 2000–Jun 2002 (Terra only), scale Terra-only counts using the Terra/(Terra+Aqua) ratio learned in the overlap years. Flag these months as lower confidence.
   - VIIRS reference: **S-NPP only**, so adding NOAA-20/21 later doesn't create a new artificial jump. Other VIIRS satellites are shown in raw mode only.
4. **Calibrate on the overlap period (2012 → latest year with both sensors)**
   - Target unit = **"VIIRS-equivalent" counts** (the future of the record).
   - Primary model: **quantile mapping (CDF matching)** of monthly MODIS → VIIRS values, stratified by **zone** (cluster of cells or land-cover class) and optionally season. Robust, non-parametric, easy to explain.
   - Baseline to compare against: log-log linear regression `log(1+V) = a + b·log(1+M)` per zone.
   - Pick the model with better cross-validated error; keep both in the Method page.
5. **Validate** (this is what wins the Validity score)
   - **Leave-one-year-out cross-validation** across overlap years.
   - Report **R², bias, MAE, Pearson r** of predicted vs observed VIIRS, per zone and overall.
   - Report **uncertainty bands** (e.g. P10–P90 of residuals) and draw them on harmonized pre-2012 values.
   - **Key chart:** raw MODIS vs raw VIIRS vs harmonized series over 2000–present, showing the 2012 discontinuity removed.
6. **Produce the harmonized series**
   - Pre-2012 months: calibrated MODIS → VIIRS-equivalent (with uncertainty).
   - 2012+ months: observed VIIRS S-NPP (plus MODIS-derived value retained for cross-checks).
   - Store model parameters + metrics in the DB with a `model_version`.
7. **Anomaly statistics** (computed per AOI at query time from cell-month values)
   - Per calendar month: historical median, mean, P10, P25, P75, P90 over a baseline period (default 2003–2022, configurable).
   - Selected month: count, **percentile rank**, **anomaly ratio** (count / median), robust z-score.
   - Labels: `< P25` Below normal, `P25–P75` Normal, `P75–P90` Above normal, `> P90` Extreme.

Pipeline is written in **Python** (pandas/numpy/scipy, pytest) in `pipeline/`, and writes results to Postgres. The web app never recomputes calibration; it only aggregates cell-month rows inside the AOI.

## 6. Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) for app, Python 3.12 for pipeline |
| Web app | **Next.js** (latest stable, App Router), **Node.js** LTS runtime, Route Handlers as the API |
| ORM / DB | **Prisma** + **PostgreSQL** with **PostGIS** (spatial queries via `$queryRaw`) |
| Styling | **TailwindCSS** (+ shadcn/ui components) |
| Map | MapLibre GL JS + a draw plugin (polygon / rectangle) with free basemap tiles |
| Charts | Apache ECharts (calendar heatmap, bands, bars) |
| Validation | Zod for API inputs |
| Tests | Vitest (unit), Playwright (e2e smoke), pytest (pipeline) |
| Lint/format | ESLint, Prettier, Ruff |
| CI/CD | **GitHub Actions** |
| Hosting | Vercel (app) + managed Postgres with PostGIS (e.g. Neon or Supabase) |
| Local dev | Docker Compose with `postgis/postgis` image |

Accessible color ramps only: **viridis / cividis** for the heatmap; never red-green. Every chart has a text/table alternative.

## 7. Architecture

```
FIRMS archive CSVs ──► pipeline/ (Python)
FIRMS API (nightly) ─┘   clean → grid → aggregate → calibrate → validate
                              │
                              ▼
                    PostgreSQL + PostGIS
          (detections, cell_month, calibration_model, region)
                              │  Prisma + $queryRaw
                              ▼
                 Next.js Route Handlers (/api/*)
                              │
                              ▼
       Next.js UI: map + calendar + charts + downloads + method page
```

### 7.1 Suggested repository layout

```
/app                 Next.js App Router pages & route handlers
/components          UI components (Map, CalendarHeatmap, SeasonChart, …)
/lib                 db client, AOI parsing, stats helpers, color scales
/prisma              schema.prisma, migrations, seed (loads data/sample)
/pipeline            Python package: ingest, grid, calibrate, validate, load
/data/sample         small committed CSV sample for tests/CI
/data/raw            full downloads (git-ignored)
/docs                METHOD.md, AI_USAGE.md, DEMO_SCRIPT.md, screenshots
/tests               vitest + playwright
/.github/workflows   ci.yml, deploy.yml, ingest-nrt.yml
docker-compose.yml
```

### 7.2 Data model (draft — refine in the implementation plan)

- `Detection` – one row per hotspot: id, sensor, satellite, lat, lon, `geom` (PostGIS point), acq_date, acq_time, confidence (normalized + original), frp, daynight, type, cell_id. Indexed on (acq_date), GiST on geom, (cell_id).
- `Cell` – cell_id, grid resolution, center lat/lon, `geom` (polygon), zone_id.
- `CellMonth` – cell_id, year, month, detections_modis, detections_viirs_snpp, fire_days_modis, fire_days_viirs, **harmonized_value**, harmonized_low, harmonized_high, source_flag (observed / calibrated / terra_only_calibrated), model_version. Unique (cell_id, year, month, model_version).
- `CalibrationModel` – model_version, method, zone_id, params (JSON), metrics (JSON: r2, mae, bias, r), trained_on (year range), created_at.
- `Region` – presets (name, slug, geometry, description).
- `IngestRun` – audit log of pipeline/NRT runs (source, rows, started/finished, status).

### 7.3 API contracts (draft)

AOI can be passed as GeoJSON polygon, bbox, or `lat,lon,radius_km`, or a preset slug. Validate with Zod; reject AOIs outside the loaded bbox with a clear message.

- `GET /api/regions` – preset AOIs.
- `POST /api/calendar` – body: AOI, start, end, mode (`harmonized` | `raw`) → year×month matrix + per-cell-month source flags.
- `POST /api/season` – monthly median, P10–P90, plus selected year line.
- `POST /api/anomaly` – selected month vs baseline: count, median, percentile, ratio, label.
- `POST /api/annual` – annual totals + trend (Sen's slope or linear) with significance.
- `POST /api/export/detections` – streamed CSV of raw detections in AOI/date range.
- `POST /api/export/series` – CSV of monthly harmonized series.
- `GET /api/method` – calibration model versions + validation metrics for the Method page.
- `GET /api/health` – DB connectivity + latest ingest date.

Performance target: any AOI query **< 1.5 s** on the deployed app.

## 8. CI/CD (GitHub Actions)

- **`ci.yml`** — on every pull request and push:
  1. Install (pnpm cache), lint (ESLint, Prettier check), typecheck (`tsc --noEmit`).
  2. `prisma validate` + `prisma generate`.
  3. Unit tests (Vitest) with coverage.
  4. Python: Ruff + pytest on `pipeline/` using `data/sample`.
  5. Integration/e2e: start a **PostGIS service container**, run `prisma migrate deploy`, seed sample data, `next build`, run Playwright smoke tests (draw AOI → calendar renders → CSV downloads).
- **`deploy.yml`** — on push to `main` (after CI passes): run `prisma migrate deploy` against production DB, deploy to Vercel production. PRs get Vercel **preview deployments** with the URL commented on the PR.
- **`ingest-nrt.yml`** (stretch) — scheduled nightly + manual trigger: fetch latest VIIRS NRT for the region via FIRMS API, append detections, recompute affected cell-months, log an `IngestRun`.
- Secrets: `DATABASE_URL`, `DIRECT_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `FIRMS_MAP_KEY`.
- Branch protection on `main`: CI must pass; small PRs per feature so the team can work in parallel.

## 9. Engineering rules for Claude Code

- **Plan before code.** For every non-trivial task, propose a plan and wait for approval.
- Work in **small, reviewable steps**; one feature per branch/PR; conventional commits (`feat:`, `fix:`, `chore:`…).
- Keep `main` deployable at all times. A working deployed MVP beats an unfinished ambitious app.
- Never commit secrets or `data/raw/`. Provide `.env.example`.
- Write tests alongside features (stats functions and AOI parsing must have unit tests).
- Don't invent dataset columns, endpoints, or numbers. If unsure, say so and check the actual file/docs.
- Prefer boring, well-known libraries; avoid adding dependencies without a reason.
- Every chart: accessible colors, axis labels with units ("hotspots, VIIRS-equivalent"), and a "data source" footnote crediting NASA FIRMS (MODIS C6.1, VIIRS S-NPP 375 m).
- Update `docs/AI_USAGE.md` and this file when a decision changes.

## 10. Hackathon timeline (Dhaka time, UTC+6)

**Before Saturday (Nov 12–13)**
- Register team + select this challenge on the official Space Apps site.
- Request FIRMS archive downloads (MODIS + VIIRS S-NPP, region bbox) **today**.
- Get a FIRMS MAP_KEY; create GitHub repo, Vercel project, Postgres (PostGIS) instance.
- Read the 2026 Project Submission Guide and Judging Guide (released Nov 13), especially rules on prior work and AI use.

**Saturday**
- Hour 0–2: repo scaffold, Docker Postgres, Prisma schema, CI green, first Vercel deploy ("hello world" is live).
- Hour 2–8: pipeline clean → grid → aggregate → load; API `calendar` + map + heatmap working end-to-end on real data.
- Hour 8–14: calibration + validation; harmonized vs raw toggle; season + anomaly endpoints and charts.
- Night: CSV exports, Method page, e2e tests, performance pass.

**Sunday**
- Morning: polish UI, accessibility check, presets & hero stories, bug fixes. **Feature freeze by midday.**
- Afternoon: record demo video, write project page (summary, NASA data used, AI usage), final deploy, submit well before the deadline.

## 11. Demo story (Presentation)

1. Problem in one chart: raw 2000–today series with the fake 2012 jump.
2. Click "Harmonize": the jump disappears; show validation metrics.
3. Draw the Chittagong Hill Tracts: calendar shows the Feb–Apr jhum season across 25 years.
4. "This month vs history": anomaly label + percentile.
5. Download the CSV as evidence for a response team.
6. Close: "When MODIS goes dark, its 20 years of history live on."

## 12. Definition of done (MVP)

- [ ] Deployed public URL works on desktop and mobile.
- [ ] Draw / lat-lon / preset AOI all work; date range works.
- [ ] Calendar heatmap, season chart, annual chart, anomaly card render from real FIRMS data.
- [ ] Raw vs Harmonized toggle works; Method page shows validation metrics and chart.
- [ ] Both CSV exports download correct data.
- [ ] CI green on `main`; deploy pipeline automatic; README with setup + data steps.
- [ ] `docs/METHOD.md`, `docs/AI_USAGE.md`, demo video, project page complete.
