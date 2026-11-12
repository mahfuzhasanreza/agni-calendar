# CLAUDE.md — Agni (`agni-calendar`) · NASA Space Apps Challenge 2026

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

## 3. Our product: **Agni** (repo / folder: `agni-calendar`)

> *"25 years of fire history, one consistent calendar."*
>
> Agni (অগ্নি) means "fire" in Bangla and Sanskrit.

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

### 4.2 Fields we use (verified against the downloaded CSVs, 2026-11-12)

- **All files share one header:** `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`. NRT files have the same columns **without `type`**.
- VIIRS files also use `brightness` / `bright_t31` (they hold the I4/I5 values; there are **no** `bright_ti4/ti5` columns).
- `satellite`: `Terra` | `Aqua` (MODIS), `SNPP`, `N20`. `instrument`: `MODIS`, `SNPP` (S-NPP file), `VIIRS` (N20 file).
- `confidence`: MODIS **0–100**; VIIRS **l / n / h**. `version`: `6.03` / `6.1NRT` (MODIS), `2` / `2.0NRT` (VIIRS). `acq_time` is zero-padded `HHMM` UTC; read it as a string.
- `type` (archive only): 0 = presumed vegetation fire, 1 = active volcano, 2 = other static land source (industry, gas flares), 3 = offshore.

### 4.4 Downloaded inventory (bbox 86,20,97,28; in `data/raw/`, git-ignored)

| Folder | Product | Archive dates | Archive rows | NRT file dates |
|---|---|---|---|---|
| `DL_FIRE_M-C61_843405` | MODIS C6.1 | 2000-11-01 → 2026-08-30 | 1,073,780 (Terra 248k, Aqua 825k) | 2026-09-02 → 2026-11-11 |
| `DL_FIRE_SV-C2_843407` | VIIRS S-NPP C2 | 2012-01-20 → 2026-07-31 | 3,543,314 | 2026-08-01 → **2026-11-01** |
| `DL_FIRE_J1V-C2_843406` | VIIRS NOAA-20 C2 | 2018-04-01 → 2026-07-31 | 1,951,605 | 2026-08-01 → 2026-11-11 |

- `type=0` rows across all archives: **5.94 M**. `type=2` is ~10% of VIIRS rows. 0.1° cells ever active: **7,512**.
- The download already includes NRT files up to Nov 2026, so the "recent months" backfill needs no API call for MVP.
- **S-NPP data stops on 2026-11-01** (FIRMS also lists S-NPP availability as ending 2 Nov 2026). NOAA-20 counts are nearly identical to S-NPP in overlap years, so NOAA-20 calibrated onto S-NPP (2018–2026 overlap) is the continuation of the reference. Check FIRMS news for S-NPP status.
- Terra has ~¼ of Aqua's detections every year (morning vs afternoon overpass), so the Terra-only scaling for Nov 2000–Jun 2002 is a factor of ~4–5 with large uncertainty. Keep the flag and wide bands.

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

**Method decisions adopted 2026-11-12** (details and rationale: `docs/PLAN.md` §1 and §4):
- Zones (MVP) = ~4 strata of long-term MODIS activity per cell × season (dry Nov–May / wet Jun–Oct). MODIS-only, so no target leakage. Land cover (MCD12Q1) is a stretch goal.
- Candidate models: quantile mapping (tie-block conditional mean, so MODIS=0 maps to the expected VIIRS small-fire count), log-log regression with Duan smearing, and a sum-preserving ratio baseline. **Select by LOYO error on zone-month totals**, also report cell-month and region-month.
- Calibration window chosen from diagnostics to avoid Terra/Aqua orbital drift (likely 2012–2019/2021). Overlap starts Feb 2012 (S-NPP record starts 20 Jan 2012). Known S-NPP outages → `gap_filled`.
- AOI uncertainty = sum of cell P10/P90, labeled a "conservative envelope".
- NRT lacks `type`: apply a static-source mask built from persistent archive `type=2` cells. A one-off NRT backfill of recent months is in the MVP (flag `observed_nrt`); the nightly job is stretch.
- Dates stay UTC (documented).
- **VIIRS reference continuity:** S-NPP data ends 2026-11-01. NOAA-20 is calibrated onto S-NPP (2018-04 → 2026-07 overlap, same code + LOYO) and fills S-NPP gaps from 2018 and all months after S-NPP's end (`n20_calibrated`). Demo line: the method survives *two* sensor handovers.
- **Headline metric:** both detections and fire-days are calibrated and validated; the DB serves one (detections unless fire-days validates clearly better).

**Pipeline facts (M3, measured on the full download):** 6.58 M raw rows → 5.94 M vegetation-fire detections (5.24 M pass the confidence filter) → 7,434 ever-active cells → 2.33 M dense cell-months; 84 detection tiles = 96 MB; database = **227 MB**; whole-region monthly query ≈ 100 ms. Full build + load ≈ 65 s with a **1.6 GB** peak (the dev machine has ~2.5 GB free; keep text columns categorical, never per-row Python strings). Commands: `uv run --project pipeline python -m agni {sample,build,load,all}`. Until M6, the active model is `raw-v0` (naive sensor stitching; it deliberately shows the 2012 jump). pandas is 3.x: categorical CSV columns are inferred as numbers when numeric (relabel to strings).

Pipeline is written in **Python** (pandas/numpy/scipy, pytest) in `pipeline/`, and writes results to Postgres. The web app never recomputes calibration; it only aggregates cell-month rows inside the AOI.

## 6. Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) for app, Python 3.12 for pipeline |
| Web app | **Next.js** (latest stable, App Router) for UI + API |
| Backend runtime | **Node.js 26** (`.nvmrc`, Vercel `26.x`). **Next.js 16.4** with `cacheComponents` on: `export const dynamic` / `revalidate` are **removed** (route handlers are uncached by default; caching is opt-in via `use cache`). All API Route Handlers run on the Node.js runtime, which is the default (Edge is deprecated). **Do not write `export const runtime`**: Next 16 with `cacheComponents` rejects it at build time. Set an explicit `maxDuration`, and call `await connection()` (from `next/server`) before any DB query so it never runs during `next build`. Not Edge, because Prisma, PostGIS queries and streamed CSV exports need it. Small Node.js (TypeScript) scripts in `/scripts` for seeding, health checks and NRT ingestion helpers |
| ORM / DB | **Prisma** + **PostgreSQL** with **PostGIS** (spatial queries via `$queryRaw`) |
| Styling | **TailwindCSS** (v4) + shadcn/ui components (initialised in M5, when the first UI components are needed) |
| Map | MapLibre GL JS + a draw plugin (polygon / rectangle) with free basemap tiles |
| Charts | Apache ECharts (calendar heatmap, bands, bars) |
| Validation | Zod for API inputs |
| Tests | Vitest (unit), Playwright (e2e smoke), pytest (pipeline) |
| Lint/format | ESLint, Prettier, Ruff |
| CI/CD | **GitHub Actions** |
| Hosting | **Free tier:** Vercel Hobby (app) + Neon free Postgres with PostGIS (aggregates only, Singapore) + GitHub Release `data-vN` (raw detections as 1° gzip CSV tiles) |
| Local dev | Docker Compose `postgis/postgis:18-3.6` on **port 5434** (`pnpm db:up`). In `.env`, `DATABASE_URL`/`DIRECT_URL` point at the **local** DB; production Neon URLs are kept as `NEON_DATABASE_URL`/`NEON_DIRECT_URL` and are only used explicitly (production loads). Prisma 7.10.1 (`prisma.config.ts`, `prisma-client` generator → `lib/generated/prisma`, `@prisma/adapter-pg`) |

Accessible color ramps only: **viridis / cividis** for the heatmap; never red-green. Every chart has a text/table alternative.

## 7. Architecture

```
FIRMS archive CSVs ──► pipeline/ (Python)
FIRMS API (nightly) ─┘   clean → grid → aggregate → calibrate → validate
                              │
                              ▼
            PostgreSQL + PostGIS (Neon)          Detection tiles (GitHub Release)
   (cell, cell_month, model_run, region)        1° gzip CSV + manifest.json
                              │  Prisma + $queryRaw         │ fetch (export only)
                              ▼                             ▼
        Next.js Route Handlers on Node.js runtime (/api/*)
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
/scripts             Node.js (TypeScript) utility scripts: seed, health check, NRT helpers
/pipeline            Python package: ingest, grid, calibrate, validate, load
/data/sample         small committed CSV sample for tests/CI
/data/raw            full downloads (git-ignored)
/docs                METHOD.md, AI_USAGE.md, DEMO_SCRIPT.md, screenshots
/tests               vitest + playwright
/.github/workflows   ci.yml, deploy.yml, ingest-nrt.yml
docker-compose.yml
```

### 7.2 Data model (final schema: `docs/PLAN.md` §3)

- **No `Detection` table** (free tier: 5.94 M rows ≈ 1 GB would not fit comfortably in Neon's free 1 GB). Raw `type=0` detections (archive + NRT, all confidence levels) are written by the pipeline as **1°×1° gzip CSV tiles + `manifest.json`** and published as a GitHub Release `data-vN`. Only the detections export reads them (`TILES_BASE_URL`).
- `Cell` – deterministic id (row*10000+col), res, center lat/lon, `geom` polygon (GiST), zone_id, ever_active.
- `Zone` – calibration strata (MVP: long-term MODIS activity strata).
- `CellMonth` – PK (cell_id, month); holds **only the active model version** (~2.35 M rows, ~250 MB). SmallInt raw counts (MODIS T/A, VIIRS S-NPP/N20), modis_ref, harmonized value/low/high for the **headline metric**, source_flag (observed / observed_nrt / calibrated / terra_only_calibrated / n20_calibrated / gap_filled). **Dense** for every ever-active cell (harmonized MODIS=0 is not 0).
- `ModelRun` – model_version, headline metric, chosen method, calibration years, metrics for both metrics + CV predictions (JSON), is_active (exactly one).
- `CalibrationModel` – per model_version × metric × zone × season × method: params + metrics (JSON).
- `Region` – presets (slug, name, name_bn, description, story, geometry).
- `IngestRun` – audit log of pipeline/NRT runs.

### 7.3 API contracts (Zod shapes: `docs/PLAN.md` §5)

AOI can be passed as GeoJSON polygon, bbox, or `lat,lon,radius_km`, or a preset slug. Validate with Zod; reject AOIs outside the loaded bbox with a clear message. Partial cells are area-weighted. The date range filters what is displayed; baseline statistics always use the baseline period.

- `GET /api/regions` – preset AOIs.
- `POST /api/analyze` – body: AOI, start, end, mode (`harmonized` | `raw`), metric, selectedMonth, baseline → monthly series + calendar matrix (with source flags) + season profile (median, P10–P90, selected year) + anomaly (count, median, percentile, ratio, robust z, label) + annual totals with Sen's slope / Mann–Kendall. One AOI query serves all panels; a CDN-cacheable `GET ?preset=` variant exists for presets.
- `POST /api/export/detections` – streamed CSV of raw detections in AOI/date range, read from the tiles that intersect the AOI (date filter + exact point-in-polygon in Node).
- `POST /api/export/series` – CSV of monthly harmonized series.
- `GET /api/method` – calibration model versions + validation metrics for the Method page.
- `GET /api/health` – DB connectivity + latest ingest date.

Performance target: any AOI query **< 1.5 s** on the deployed app.

**Implemented (M4):** `GET /api/regions`, `POST /api/analyze`, `GET /api/analyze?preset=` (CDN-cacheable). Presets are **approximate bounding boxes in `lib/regions.ts`** (the `region` table is unused for now). The anomaly defaults to the **latest complete month** (`ingest_run.data_to` stores the real last detection date). The selected month is compared with the same calendar month in the baseline years **excluding its own year**. Measured on the full data (local): CHT ≈ 0.1 s, whole region ≈ 1.2 s. SQL rule: the per-cell weight CTE must be `MATERIALIZED`, otherwise Postgres inlines it and recomputes the spatial weight for every cell-month row (28 s instead of 1 s).

## 8. CI/CD (GitHub Actions)

- **`ci.yml`** — on every pull request and push:
  1. Install (pnpm cache), lint (ESLint, Prettier check), typecheck (`tsc --noEmit`).
  2. `prisma validate` + `prisma generate`.
  3. Unit tests (Vitest) with coverage.
  4. Python: Ruff + pytest on `pipeline/` using `data/sample`.
  5. Integration/e2e: start a **PostGIS service container**, run `prisma migrate deploy`, seed sample data, `next build`, run Playwright smoke tests (draw AOI → calendar renders → CSV downloads).
- **`deploy.yml`** — on push to `main` (after CI passes, via `workflow_run`): run `prisma migrate deploy` against production DB, deploy to Vercel production with the Vercel CLI (`vercel.json` disables Vercel's own Git deploys). PRs get Vercel **preview deployments** with the URL commented on the PR; previews use their **own Neon database branch** (Vercel–Neon integration, Preview only) and never run migrations against production.
- **`ingest-nrt.yml`** (stretch) — scheduled nightly + manual trigger: fetch latest VIIRS NRT for the region via FIRMS API, append detections, recompute affected cell-months, log an `IngestRun`.
- Secrets: `DATABASE_URL`, `DIRECT_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `FIRMS_MAP_KEY`, `REVALIDATE_SECRET`. Env: `TILES_BASE_URL`.
- Branch protection on `main`: CI must pass; small PRs per feature so the team can work in parallel.

## 9. Engineering rules for Claude Code

- The approved implementation plan (schema, pipeline, API, UI, CI, tests, milestones M0–M11, team split, risks) is in **`docs/PLAN.md`**. Follow its milestone order; propose each milestone before executing it.

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
