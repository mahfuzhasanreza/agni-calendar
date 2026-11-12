# Agni — Implementation Plan

> Approved 2026-11-12. Companion to `CLAUDE.md` (which remains the source of truth for product/rules).
> Build proceeds milestone by milestone (§9); each milestone is proposed before it is executed.
> Open questions are tracked in §12 — until answered, the **recommended default** is used.

---

## 1. Goal and adjustments to CLAUDE.md

1. Build one sensor-independent, monthly, 0.1°-gridded hotspot record (2000→today) for Bangladesh / NE India / W Myanmar by calibrating MODIS onto VIIRS S-NPP ("VIIRS-equivalent").
2. Prove it with leave-one-year-out (LOYO) cross-validation and a before/after chart where the 2012 jump disappears.
3. Serve it via Next.js + PostGIS: any AOI (draw / lat-lon / preset) + date range → year×month calendar, season profile, anomaly label, annual trend.
4. Downloadable raw-detection and harmonized-series CSVs; accessible colors; table alternatives.
5. Deployed MVP early on Saturday, then iterate. The method is the differentiator.

### Adjustments (adopted; CLAUDE.md updated accordingly)

| # | Issue | Decision |
|---|---|---|
| a | Local branch `master` vs `main` | Use `main` |
| b | Sparse `CellMonth` would treat missing as 0, but harmonized(MODIS=0) > 0 (small fires MODIS misses) | Store **dense** months for every ever-active cell; never-active cells = 0 everywhere; zero-fill gaps at query time |
| c | Quantile mapping preserves distributions, not conditional means; users see AOI sums | Validate at cell-month, **zone-month total** (model selection metric) and region-month total; add a sum-preserving **ratio** baseline; Duan smearing for log-log |
| d | Terra/Aqua orbital drift in recent years | Calibration window chosen by diagnostics (likely 2012–2019/2021); report per-year parameter stability |
| e | NRT has no `type` field | Static-source mask from cells with persistent archive `type=2` |
| f | Archive lags by months; "this month" isn't current | One-off FIRMS API backfill of recent months in MVP, flagged `observed_nrt` (provisional); nightly job stays stretch |
| g | Volume: 5.94 M `type=0` detections ≈ 1 GB in Postgres > free tiers (Neon free: 1 GB) | **Free-tier design (decided 2026-11-12):** raw detections are **not stored in Postgres**. They live as gzip CSV tiles (1°×1°) in a GitHub Release (`data-vN`), read only by the detections export. Postgres (Neon free) holds aggregates only (~250 MB) |
| r | S-NPP data stops 2026-11-01 (verified in download) | VIIRS reference = S-NPP; after its end (and for S-NPP gaps from 2018) use **NOAA-20 calibrated onto S-NPP** over the 2018–2026 overlap (`n20_calibrated`). Same calibration code as MODIS→S-NPP |
| h | 4 stats endpoints = 4 identical AOI scans | Single `POST /api/analyze` returns series + calendar + season + anomaly + annual; exports separate |
| i | PR previews against prod DB | Previews get their own Neon branch (Vercel–Neon integration); migrations only from `main` |
| j | Date range vs baseline ambiguity | Date range filters display only; baseline fixed (default 2003–2022) |
| k | Partially covered cells | Area-fraction weighting; exports use exact point-in-polygon; documented |
| l | Summing cell P10/P90 | Shown as a "conservative envelope" |
| m | Zones undefined | MVP: ~4 strata of long-term MODIS activity per cell × season (dry Nov–May / wet Jun–Oct). Stretch: MCD12Q1 land cover |
| n | S-NPP starts 20 Jan 2012; outages exist | Overlap starts Feb 2012; documented gap list → `gap_filled` |
| o | `acq_date` is UTC | Keep UTC; document |
| p | S-NPP will end too | Generic "sensor → reference over overlap" calibration code |
| q | Prior-work rules | Verify in the 2026 Submission Guide (Nov 13) |

---

## 2. Repository tree

```
agni-calendar/
├─ app/
│  ├─ layout.tsx  page.tsx              # main explorer
│  ├─ method/page.tsx  about/page.tsx
│  └─ api/
│     ├─ health/route.ts  regions/route.ts  method/route.ts
│     ├─ analyze/route.ts
│     └─ export/{detections,series}/route.ts
├─ components/
│  ├─ map/{MapView,AoiDrawControl,AoiLatLonForm,PresetPicker,CellLayer}.tsx
│  ├─ charts/{EChart,CalendarHeatmap,SeasonChart,AnnualChart,RawVsHarmonizedChart,ValidationScatter}.tsx
│  ├─ panels/{AnomalyCard,ControlsPanel,DateRangePicker,ModeToggle,ExportButtons,DataTable,SourceFootnote,Legend}.tsx
│  └─ ui/                               # shadcn generated
├─ lib/
│  ├─ db.ts  env.ts  contracts.ts       # Zod = API contract shared FE/BE
│  ├─ aoi.ts  sql/{analyze,export}.ts
│  ├─ stats/{quantiles,anomaly,trend,calendar}.ts
│  ├─ csv.ts  colors.ts  format.ts
│  └─ generated/prisma/                 # git-ignored
├─ prisma/{schema.prisma, migrations/, seed.ts}   prisma.config.ts
├─ scripts/{health-check.ts, refresh-presets.ts}
├─ pipeline/
│  ├─ pyproject.toml  uv.lock
│  ├─ agni/{config,ingest,clean,grid,aggregate,reference,zones,calibrate,validate,harmonize,static_mask,nrt,load,plots,cli}.py
│  └─ tests/{conftest.py, test_*.py, fixtures/}
├─ data/
│  ├─ sample/{modis_sample.csv.gz, viirs_snpp_sample.csv.gz, regions.geojson, golden/*.json, README.md}
│  └─ raw/  interim/                    # git-ignored
├─ docs/{PLAN.md, METHOD.md, AI_USAGE.md, DEMO_SCRIPT.md, screenshots/}
├─ tests/{unit/*.test.ts, e2e/*.spec.ts}
├─ .github/workflows/{ci.yml, deploy.yml, ingest-nrt.yml}
├─ docker-compose.yml  vercel.json  .env.example  README.md
└─ eslint.config.mjs  .prettierrc  vitest.config.ts  playwright.config.ts  tsconfig.json
```

`data/sample/golden/*.json` = stats cases computed with scipy/numpy and asserted by **both** pytest and Vitest, so Python and TS stats agree.

---

## 3. Prisma schema, PostGIS, data volume

Prisma version pinned at scaffold (if v7: `prisma.config.ts` for URLs, `prisma-client` generator, `pg` adapter).

```prisma
generator client { provider = "prisma-client"  output = "../lib/generated/prisma" }
datasource db   { provider = "postgresql" }

enum Sensor       { MODIS_T MODIS_A VIIRS_SNPP VIIRS_N20 VIIRS_N21 }
enum SourceFlag   { observed observed_nrt calibrated terra_only_calibrated n20_calibrated gap_filled }
enum IngestStatus { running success failed }

model Zone {
  id          Int     @id
  name        String
  description String?
  cells       Cell[]
  @@map("zone")
}

model Cell {
  id         Int     @id                    // row*10000+col, identical in Python & SQL
  row        Int     @db.SmallInt
  col        Int     @db.SmallInt
  res        Float   @db.Real
  centerLat  Float   @map("center_lat") @db.Real
  centerLon  Float   @map("center_lon") @db.Real
  geom       Unsupported("geometry(Polygon,4326)")
  zoneId     Int?    @map("zone_id")
  zone       Zone?   @relation(fields: [zoneId], references: [id])
  everActive Boolean @default(false) @map("ever_active")
  @@index([geom], type: Gist)
  @@map("cell")
}

// No Detection table (free-tier design): raw detections live in tile files, see §4 `tiles` and §5 export.

// Holds ONLY the active model version (≈2.35 M dense rows = 7,512 ever-active cells × 313 months).
// Activating a new version replaces the contents in one transaction; old versions keep their
// metrics in ModelRun. Counts are SmallInt (pipeline asserts < 32,767).
model CellMonth {
  cellId       Int        @map("cell_id")
  month        DateTime   @db.Date                          // first day of month
  detModisT    Int        @default(0) @map("det_modis_t") @db.SmallInt
  detModisA    Int        @default(0) @map("det_modis_a") @db.SmallInt
  detViirsSnpp Int        @default(0) @map("det_viirs_snpp") @db.SmallInt
  detViirsN20  Int        @default(0) @map("det_viirs_n20") @db.SmallInt
  modisRef     Float?     @map("modis_ref") @db.Real        // T+A, or scaled Terra-only
  harm         Float      @db.Real                          // headline metric, VIIRS-S-NPP-equivalent
  harmLo       Float      @map("harm_lo") @db.Real
  harmHi       Float      @map("harm_hi") @db.Real
  sourceFlag   SourceFlag @map("source_flag")
  @@id([cellId, month])
  @@map("cell_month")
}

model ModelRun {
  modelVersion  String   @id @map("model_version") @db.VarChar(32)
  metric        String   // headline metric served: detections | fire_days (both validated)
  method        String
  gridRes       Float    @map("grid_res") @db.Real
  calibFrom     Int      @map("calib_from")
  calibTo       Int      @map("calib_to")
  metrics       Json
  cvPredictions Json     @map("cv_predictions")
  isActive      Boolean  @default(false) @map("is_active")
  notes         String?
  createdAt     DateTime @default(now()) @map("created_at")
  strata        CalibrationModel[]
  @@map("model_run")
}

model CalibrationModel {
  id           Int      @id @default(autoincrement())
  modelVersion String   @map("model_version") @db.VarChar(32)
  run          ModelRun @relation(fields: [modelVersion], references: [modelVersion], onDelete: Cascade)
  metric       String   // detections | fire_days
  zoneId       Int      @map("zone_id")
  season       String   // dry | wet | terra_scale
  method       String
  params       Json
  metrics      Json
  @@unique([modelVersion, metric, zoneId, season, method])
  @@map("calibration_model")
}

model Region {
  id          Int     @id @default(autoincrement())
  slug        String  @unique
  name        String
  nameBn      String? @map("name_bn")
  description String
  story       String?
  geom        Unsupported("geometry(MultiPolygon,4326)")
  sortOrder   Int     @default(0) @map("sort_order")
  @@map("region")
}

model IngestRun {
  id         Int          @id @default(autoincrement())
  kind       String       // archive | nrt | calibration | sample
  sensor     Sensor?
  startedAt  DateTime     @default(now()) @map("started_at")
  finishedAt DateTime?    @map("finished_at")
  rowsIn     Int?         @map("rows_in")
  rowsLoaded Int?         @map("rows_loaded")
  dataFrom   DateTime?    @map("data_from") @db.Date
  dataTo     DateTime?    @map("data_to") @db.Date
  status     IngestStatus
  message    String?
  @@map("ingest_run")
}
```

**PostGIS in migrations**
- `0000_postgis`: hand-written `CREATE EXTENSION IF NOT EXISTS postgis;`.
- Later migrations: `prisma migrate dev --create-only`, review SQL, then apply.
- GiST indexes declared in schema (`@@index([geom], type: Gist)`) so Prisma doesn't try to drop them. If Prisma rejects it on `Unsupported`, add raw SQL and a CI drift check (`prisma migrate diff` must be empty).
- Geometry is never written via the Prisma client: Python loads with `COPY` + `ST_MakeEnvelope` / `ST_GeomFromGeoJSON`; the app reads with `$queryRaw`.
- One active `ModelRun` enforced in the loader transaction.

**Volume (measured from the download, 2026-11-12)**

| Item | Rows | Size | Where |
|---|---|---|---|
| Cell (0.1°) | 8,800 (7,512 ever active) | < 5 MB | Neon |
| CellMonth (active version, dense) | ~2.35 M | ~230–260 MB incl. PK | Neon |
| ModelRun / CalibrationModel / Region / Zone / IngestRun | small | < 10 MB | Neon |
| **Neon total** | | **~250–280 MB of 1 GB free** | |
| Raw detections (`type=0`, archive + NRT): MODIS 1.04 M, S-NPP 3.18 M, NOAA-20 1.73 M | 5.94 M | ~100–150 MB gzip | GitHub Release tiles |

If Neon gets tight: drop `det_viirs_n20` from the DB (it's in the tiles), or store months where every count is 0 sparsely and add the per-stratum "MODIS=0" value at query time.

---

## 4. Python pipeline (`pipeline/agni/`, uv; pandas, numpy, scipy, pyarrow, psycopg[binary]; matplotlib dev-only)

Stages write Parquet to `data/interim/` so each step re-runs independently.

| Module | Key functions | In → Out |
|---|---|---|
| `config` | `Config` (bbox, grid_res, calib years, baseline, thresholds, model_version) | env/CLI |
| `ingest` | `read_firms_csv`, `detect_sensor`, `validate_headers` (fail loudly) | raw CSV(.gz) → unified schema |
| `clean` | `filter_vegetation`, `conf_class`, `filter_confidence`, `drop_duplicates`, `clip_bbox` | → `detections.parquet` |
| `grid` | `cell_id(lat, lon)` (integer math + epsilon guard), `cells_frame()` | → `cells.parquet` |
| `aggregate` | `monthly_obs` (dense for ever-active cells; per-sensor detections & fire-days; MODIS fire-days = T∪A) | → `cell_month_obs.parquet` |
| `reference` | `modis_reference`: T+A from Jul 2002; earlier `T × f(zone,season)`, `f = Σ(T+A)/ΣT` over 2003–2011 | → `modis_ref` + flag |
| `zones` | `assign_zones(obs, k=4)` — strata by mean MODIS activity (no VIIRS → no leakage) | → `zone_id` |
| `calibrate` | `QuantileMapper`, `LogLogRegression` (Duan smearing), `RatioModel`: `fit` / `predict` / `params` | per zone × season × metric |
| `validate` | `loyo_cv`, `metrics` (R², bias, MAE, Pearson r), `residual_bands`, `compare_models` | → metrics JSON + CV predictions |
| `harmonize` | pre-2012 calibrated + bands; 2012+ observed S-NPP; gaps → calibrated + `gap_filled` | → `cell_month.parquet` |
| `static_mask` | persistent `type=2` cells | → `static_cells.json` |
| `nrt` | `fetch_area(source, bbox, days)` (FIRMS API — verify endpoint) | backfill / stretch |
| `tiles` | `write_tiles(detections, out_dir)`: one gzip CSV per 1°×1° tile (`t{lat0}_{lon0}.csv.gz`, rows sorted by date), plus `manifest.json` (tile → bbox, rows, date range, sha256, dataset version) | → `data/tiles/` → GitHub Release `data-vN` |
| `load` | `load_cells`, `load_cell_month`, `load_model_run`, `activate`, `load_regions` | → Postgres |
| `plots` | raw vs harmonized; held-out scatter | → `docs/` PNGs |
| `cli` | `python -m agni {ingest,aggregate,calibrate,load,all,nrt} [--sample]` | |

**Quantile mapping:** per stratum, overlap pairs (MODIS_ref, S-NPP) per cell-month. Counts are discrete, so each MODIS value `m` occupies a CDF block `[F(m⁻), F(m)]`; output = **mean of the VIIRS quantile function over that block**. Monotone, defined at M=0 (captures small fires MODIS misses), explainable. Above training max: top-quantile ratio. Params stored as knots.

**LOYO CV:** for each calibration year y, fit each candidate on the other years and predict y. Pool held-out predictions; metrics at cell-month, zone-month total (**selection**), region-month total, for detections and fire-days. Test asserts y never in training. Bands = P10/P90 of held-out obs/pred ratio per stratum × MODIS-value bin (additive for M=0). Terra-only scaling gets its own LOYO on 2003–2011; its extra error widens flagged months' bands.

**VIIRS reference continuity:** S-NPP data ends 2026-11-01. NOAA-20 is calibrated onto S-NPP over 2018-04 → 2026-07 with the same model code and LOYO validation. Its values fill S-NPP gaps (from 2018) and months after S-NPP's end (`n20_calibrated`). Before 2018, gaps fall back to calibrated MODIS (`gap_filled`).

**Loading:** psycopg3 `COPY` → `UNLOGGED` staging → one transaction (`TRUNCATE`/replace `cell_month`, `INSERT … SELECT` with geometry for cells, `IngestRun`, `ANALYZE`). Idempotent. Prod loads via `DIRECT_URL` from a laptop, not CI. Tiles are uploaded with `gh release upload data-vN data/tiles/* --clobber`.

---

## 5. API (Node runtime, explicit `maxDuration`; no `dynamic` export: removed under Next 16 `cacheComponents`, handlers are uncached by default)

```ts
// lib/contracts.ts (shape; exact code in M4)
const Month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const Aoi = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bbox"), bbox: z.tuple([Lon, Lat, Lon, Lat]) }),
  z.object({ type: z.literal("polygon"), geometry: GeoJsonPolygon /* ≤500 vertices */ }),
  z.object({ type: z.literal("circle"), lat: Lat, lon: Lon, radiusKm: z.number().min(1).max(200) }),
  z.object({ type: z.literal("preset"), slug: z.string().max(64) }),
]);
export const AnalyzeRequest = z.object({
  aoi: Aoi, start: Month, end: Month,
  mode: z.enum(["harmonized", "raw"]).default("harmonized"),
  // no metric switch: the DB serves one headline metric (ModelRun.metric)
  selectedMonth: Month.optional(),
  baseline: z.object({ from: z.number().int(), to: z.number().int() }).default({ from: 2003, to: 2022 }),
});
// AnalyzeResponse:
// { aoi: {areaKm2, cells, partialCells, bbox}, modelVersion, units, dataThrough,
//   series: [{month, value, low, high, flag, raw: {modisT, modisA, modisRef, viirsSnpp, viirsN20, viirsN21, naive}}],
//   calendar: {years, values[][], flags[][]},
//   season: {months: [{month, median, mean, p10, p25, p75, p90}], selectedYear: {year, values}},
//   anomaly: {month, value, median, p10, p25, p75, p90, percentileRank, ratio|null, robustZ|null,
//             label: below_normal|normal|above_normal|extreme, baselineYears, yearsWithFire},
//   annual: {years: [{year, total, low, high, complete}], trend: {method:"sen", slopePerYear, intercept, mannKendallP, significant}} }
```

| Route | Purpose |
|---|---|
| `GET /api/health` | DB ping, PostGIS version, active model, latest ingest |
| `GET /api/regions` | presets (GeoJSON + stories) |
| `POST /api/analyze` (+ CDN-cacheable `GET ?preset=…`) | all panels, one query |
| `POST /api/export/detections` | streamed CSV: date, time_utc, lat, lon, sensor, satellite, confidence_raw, conf_class, frp, brightness, daynight, type |
| `POST /api/export/series` | month, harmonized, low, high, flag, per-sensor raw, model_version |
| `GET /api/method` | ModelRun metrics + CV predictions |

**AOI SQL (single `$queryRaw`):** `aoi` CTE (envelope / GeoJSON + `ST_MakeValid` / geography buffer; reject outside loaded bbox) → `cells` CTE via GiST `ST_Intersects`, weight 1 for fully covered else area fraction → join `cell_month` on PK, `SUM(col*w) GROUP BY month` → zero-fill with `generate_series`. Stats (quantiles, percentile rank, robust z, Sen + Mann–Kendall) in `lib/stats` on ~314 points.

**Performance:** whole region ≈ 1.5 M index rows — target < 1 s warm. Mitigations in order: covering index → CDN cache on presets → max AOI ~150k km² → 0.5° rollup. Vercel + DB co-located (Singapore).

**Detections export (tile-based):** compute the 1° tiles that intersect the AOI bbox (`manifest.json`, cached) → fetch each `tile.csv.gz` from `TILES_BASE_URL` (a GitHub Release URL in prod, `file://data/tiles` locally/CI) → stream-gunzip (Node `zlib`) → filter by date range and exact point-in-polygon (small tested ray-casting function in `lib/geo.ts`, no new dependency) → stream CSV to the client. Tiles average ~1–2 MB, so a typical AOI reads a handful. Cap ~500k rows with a clear message. Verify Vercel duration/response limits.

---

## 6. UI

**`/` explorer** — controls + map on top, panels below; stacks on mobile.
- **ControlsPanel:** AOI tabs (Draw / Lat-Lon+radius / Bbox / Preset), month-year DateRangePicker, ModeToggle (Harmonized | Raw), selected month.
- **MapView:** MapLibre + OpenFreeMap/CARTO basemap; **terra-draw** (fallback mapbox-gl-draw); `CellLayer` choropleth of AOI cells.
- **CalendarHeatmap:** ECharts heatmap years × months; zero = neutral gray; terra-only / gap-filled = decal pattern; NRT = outline; tooltip with band + source.
- **RawVsHarmonizedChart:** raw MODIS, raw VIIRS, harmonized + band, 2012 markLine — the hero chart.
- **SeasonChart:** median + P10–P90 band + selected-year line.
- **AnomalyCard:** value, median, percentile ("higher than 18 of 20 years"), ratio, icon + text label; zero-median case ("fire in a month that had none in 19 of 20 years").
- **AnnualChart:** bars + whiskers, Sen trend + p-value, partial years hatched.
- **ExportButtons**, per-chart `DataTable` in `<details>`, `SourceFootnote` (NASA FIRMS: MODIS C6.1, VIIRS S-NPP 375 m).

**`/method`:** 60-second explanation + details, before/after chart, metrics table (zone × model × level), held-out scatter, limitations.

**Colors (`lib/colors.ts`):** viridis heatmap (cividis option); Okabe-Ito series with distinct dashes (MODIS `#E69F00` dashed, VIIRS `#0072B2` dotted, harmonized near-black solid + gray band); anomaly blue→orange ordinal + icon + text. No red–green. axe checks in e2e.

---

## 7. GitHub Actions

**`ci.yml`** (PR + push to `main`; cancel in-progress)
- `web`: pnpm cache → install → eslint → prettier --check → `tsc --noEmit` → `prisma validate` → `prisma generate` → vitest --coverage.
- `pipeline`: setup-uv → ruff check → ruff format --check → pytest.
- `e2e` (needs both): service `postgis/postgis:18-3.6` → `prisma migrate deploy` → drift check → `uv run python -m agni all --sample` → seed regions → `next build` → Playwright (chromium) → upload report on failure. No secrets.

**`deploy.yml`**
- prod: `workflow_run` of CI succeeded on `main` → environment `production` → `prisma migrate deploy` (DIRECT_URL) → `vercel pull/build --prod/deploy --prebuilt --prod` → smoke `/api/health`.
- preview: `pull_request` (non-fork) → `vercel deploy` (its own Neon branch via the Vercel–Neon integration) → sticky PR comment with URL.
- `vercel.json`: `git.deploymentEnabled: false`, `regions: ["sin1"]`.

**`ingest-nrt.yml`** (stretch): cron `30 20 * * *` (02:30 Dhaka) + dispatch → `agni nrt --days 3` (fetch, static mask, upsert `source=nrt`, recompute affected cell-months, `IngestRun`) → revalidate webhook. Archive data replaces NRT rows when available.

**Secrets:** `DATABASE_URL`, `DIRECT_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `FIRMS_MAP_KEY`, `REVALIDATE_SECRET`. Env (not secret): `TILES_BASE_URL`.

**Hosting (free tier):** Vercel Hobby + Neon free (Singapore, 1 GB, Postgres 18.6 + PostGIS 3.6.4, scales to zero → first query after idle has a cold start of up to ~1 s; ping `/api/health` before demos) + GitHub Release for detection tiles. In e2e CI, the pipeline writes sample tiles to `data/tiles/` and `TILES_BASE_URL=file://…`.

---

## 8. Testing

- **pytest:** cell_id edges; header validation; type/confidence filters; T∪A fire-days; dense fill; Terra scaling; **synthetic recovery** (known monotone transform recovered by QM and log-log); QM monotone + zero block; **LOYO no-leakage**; metrics vs hand values; loader idempotency (when `DATABASE_URL` set); golden JSON generation.
- **Vitest:** AOI parsing (bbox order, outside region, self-intersection, circle, unknown preset); quantiles (numpy type 7), percentile rank with ties, label boundaries, robust z with MAD=0, ratio with median=0, Sen/MK vs golden; calendar matrix; CSV escaping; Zod round-trip.
- **Playwright:** CHT preset → calendar + table rows; raw/harmonized toggle changes summary; lat/lon AOI; rectangle draw (one retried test); detections CSV header + ≥1 row; `/method` metrics; axe scan.
- **`data/sample/` (≤ 5 MB gz):** real FIRMS rows, original headers, full 2000→latest for CHT (~92.0–92.5°E, 22.5–23.0°N) and Sundarbans (~89.0–89.5°E, 21.8–22.3°N), incl. some `type=2`, low-confidence and NOAA-20 rows; `regions.geojson`; `README.md` with provenance + FIRMS citation. Synthetic fixtures generated in tests.

---

## 9. Build order

| # | When | Milestone | Done when |
|---|---|---|---|
| M0 | Thu/Fri (no code) | FIRMS archive request, MAP_KEY, GitHub repo (`main`), Vercel project, DB with PostGIS | requests confirmed; accounts exist |
| M1 | Sat H0–1 | ✅ Scaffold Next.js 16.4/TS/Tailwind v4 (shadcn moved to M5), ESLint/Prettier/Vitest, `ci.yml` (web job), `deploy.yml`, hello page | public URL live; CI green on `main` |
| M2 | H1–2.5 | ✅ docker-compose, Prisma schema + PostGIS migrations, `/api/health`, migrate in deploy | prod `/api/health` → db ok + PostGIS version |
| M3 | H1–5 (data) | ✅ ingest → clean → grid → aggregate → load, sample, pytest job | `agni all --sample` fills local DB; full region in prod as `raw-v0` |
| M4 | H2.5–5 (backend) | ✅ `contracts.ts` + mock JSON (H2.5), `lib/aoi`, `lib/stats`, `/api/regions`, `/api/analyze` | vitest green; CHT analyze < 1.5 s locally |
| M5 | H2–8 (frontend) | ✅ map + AOI inputs + presets, CalendarHeatmap, mode toggle | **MVP-0 on prod ~H8**: CHT → real 25-year calendar |
| M6 | H8–13 (data) | zones, reference, 3 models, LOYO, harmonize, load `v1`, `/api/method` | metrics in DB; prod toggle removes the 2012 jump |
| M7 | H8–13 (FE/BE) | Season, Anomaly, Annual, RawVsHarmonized, DataTables | all panels on prod for 3 presets |
| M8 | Night | CSV exports (streamed) | open in spreadsheet; counts match SQL |
| M9 | Night | `/method` + `docs/METHOD.md` + plots; e2e in CI | e2e green |
| M10 | Sun AM | perf (EXPLAIN, caching), a11y, mobile, share-link, NRT backfill | whole-region < 1.5 s on prod; axe clean |
| M11 | Sun midday | **Feature freeze**; fixes, README, AI_USAGE, video, project page | DoD checklist complete; submitted early |
| S1–S4 | if green | nightly NRT, watchlist, PNG export, Bangla, Argentina | — |

---

## 10. Team split (directory ownership)

| Role | Owns | First deliverable |
|---|---|---|
| Data / pipeline | `pipeline/`, `data/sample/`, `docs/METHOD.md` | M3 → M6 |
| Backend | `app/api/`, `lib/` (not colors), `prisma/` | `lib/contracts.ts` + mock JSON by H2.5 |
| Frontend | `app/(pages)`, `components/`, `lib/colors.ts` | builds on mocks; live API at M5 |
| DevOps | `.github/`, `docker-compose.yml`, `vercel.json`, `scripts/`, accounts | M1/M2, e2e, perf |
| Demo / story | `docs/DEMO_SCRIPT.md`, `docs/AI_USAGE.md`, presets/stories, video, project page | hero-story research by Sat evening |

Schema changes only via Backend; contract changes reviewed by FE + BE; PRs < 400 lines, squash-merge.

---

## 11. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Archive email late | FIRMS yearly per-country CSV downloads (verify); smaller bbox (CHT + Mizoram); API for recent months |
| Neon free 1 GB fills up | drop `det_viirs_n20` from DB; sparse all-zero months; 0.25° grid (≈6× fewer rows) |
| GitHub Release download slow/blocked from Vercel | move tiles to Vercel Blob (same tile format, only `TILES_BASE_URL` changes) |
| Neon cold start breaks the 1.5 s target | ping `/api/health` before demos; preset responses CDN-cached |
| Slow AOI queries | covering index → preset CDN cache → AOI cap → 0.5° rollup → 0.25° grid |
| Weak cell-level calibration | present at zone/AOI scale; switch to fire-days if better; show uncertainty honestly |
| Vercel limits | streaming + caps; pre-generated preset exports; Next.js standalone on Render/Fly |
| Prisma + PostGIS friction | spatial via `$queryRaw`; geometry written only by Python |
| Draw plugin issues | lat/lon, bbox, presets always work; swap plugin |
| MODIS drift / S-NPP gaps | restricted calibration window; flags + gap list |
| Time | every milestone deployable; freeze Sunday midday |
| Prior-work rule | before Saturday only accounts, data requests, reading |

---

## 12. Open questions (defaults in use until answered)

| # | Question | Default |
|---|---|---|
| 1 | Team size and skills | roles as in §10 |
| 2 | FIRMS archive | ✅ downloaded: MODIS C6.1, VIIRS S-NPP, NOAA-20 (archive + NRT to 2026-11-11) in `data/raw/` |
| 3 | Budget | ✅ **free tier**: Neon free + Vercel Hobby + GitHub Release tiles |
| 4 | Scaffolding allowed before Saturday? | rules publish 2026-11-13; no code before Saturday until confirmed |
| 5 | GitHub repo | ✅ `github.com/mahfuzhasanreza/agni-calendar`, branch `main`, remote set |
| 6 | Headline metric | calibrate both; show detections unless fire-days validates clearly better |
| 7 | Accept §1 adjustments | yes (adopted) |
| 8 | Bangla UI, Argentina | stretch only |
