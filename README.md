# Agni (অগ্নি)

**25 years of fire history, one consistent calendar.**

**Live app: https://agni-calendar.vercel.app** · Method and validation: [/method](https://agni-calendar.vercel.app/method) · Full write-up: [`docs/METHOD.md`](docs/METHOD.md)

Agni turns 25 years of NASA MODIS and VIIRS active-fire hotspots (Nov 2000 → Nov 2026) into one sensor-independent burning calendar for any area in Bangladesh, Northeast India and western Myanmar: monthly calendar, fire-season profile, "this month vs history" anomaly label, annual trend, and downloadable CSV evidence. Built for the NASA Space Apps Challenge 2026, challenge _Harmonization of MODIS and VIIRS Hot Spots_ (CONAE / NASA).

## Why

Over the same months VIIRS (375 m) reports about **5× more** fire detections than MODIS (1 km), because it also sees small fires. Joining the two naively makes fire look as if it exploded in 2012 (×4.3 across the region). Agni converts the MODIS years into VIIRS-equivalent counts, validated year by year, so the whole record speaks one unit.

In the Chittagong Hill Tracts the raw record shows fire significantly **increasing** (+374 hotspots/year, 2003–2025, Mann–Kendall p = 0.004); the harmonized record shows it significantly **decreasing** (−470/year, p = 0.001). The apparent increase was the sensor switch.

## How (60 seconds)

1. **Clean:** vegetation fires only (FIRMS `type` 0); MODIS confidence ≥ 30, VIIRS nominal/high.
2. **Grid:** detections per 0.1° cell per month (7,434 burning cells × 313 months).
3. **Reference sensors:** MODIS Terra + Aqua; VIIRS S-NPP, continued by NOAA-20 after S-NPP stopped (1 Nov 2026).
4. **Calibrate** on the 2012–2025 overlap: a VIIRS/MODIS ratio per 1° tile and season (it ranges from ~3 in jhum hills to 6–8 in agricultural plains).
5. **Validate** by leaving each year out and predicting it from MODIS: held-out 1° tile-month R² 0.952, error 21 %, bias −0.2 %; region-month R² 0.984.
6. **Publish** one record in VIIRS-equivalent units with P10–P90 uncertainty bands on every estimated month.

## Architecture

```
NASA FIRMS CSVs ──► Python pipeline (pipeline/agni)
                    clean → grid → aggregate → calibrate → validate → load
                         │                                   │
                         ▼                                   ▼
            Neon Postgres + PostGIS                Vercel Blob
            cells, monthly values, 1° rollup,      raw detections as 1° gzip CSV tiles
            models + validation report             (CSV export only)
                         │                                   │
                         └──────────► Next.js on Vercel ◄────┘
                                      /api/analyze, /api/export/*, /api/method
                                      map + calendar + charts + downloads + method page
```

| Layer    | Tech                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| App      | Next.js 16 (App Router, TypeScript strict), Tailwind 4, shadcn/ui, MapLibre GL + terra-draw, ECharts                 |
| Data     | Neon Postgres 18 + PostGIS 3.6 (Prisma 7), Vercel Blob for detection tiles                                           |
| Pipeline | Python 3.12, pandas, NumPy, psycopg                                                                                  |
| Quality  | Vitest (83), pytest (46), Playwright (11 incl. axe accessibility), ESLint, Prettier, Ruff                            |
| CI/CD    | GitHub Actions: lint/types/tests, PostGIS service + sample load + e2e, migrations and Vercel deploy with CDN warm-up |

Performance (production, warm): preset areas ~0.2 s from the CDN, any drawn area < 1 s, whole region 0.44 s; exports stream.

## Local development

Requirements: Node 26 (`.nvmrc`), pnpm 9, Python 3.12 with [uv](https://docs.astral.sh/uv/), Docker.

```bash
pnpm install                 # also generates the Prisma client and copies the MapLibre worker
cp .env.example .env         # local database defaults work as-is
pnpm db:up && pnpm db:deploy # PostGIS in Docker (port 5434) + migrations
uv run --project pipeline python -m agni all --raw data/sample --kind sample   # sample data (~10 s)
pnpm dev                     # http://localhost:3000
```

Full data: request the FIRMS archive (MODIS C6.1, VIIRS S-NPP and NOAA-20, bbox 86,20,97,28) into `data/raw/`, then `uv run --project pipeline python -m agni all` (~2 min, 1.6 GB RAM peak).

Checks (the same ones CI runs):

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test     # web
cd pipeline && uv run ruff check . && uv run pytest               # pipeline (AGNI_TEST_DATABASE_URL for DB tests)
E2E_BASE_URL=http://localhost:3000 pnpm test:e2e                   # browser tests against a running app
```

## Repository

| Path                          | What                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `app/`, `components/`, `lib/` | Next.js app: pages, API routes, charts, statistics (`lib/stats`), AOI parsing      |
| `pipeline/agni/`              | ingest, clean, grid, aggregate, zones, calibrate, validate, harmonize, tiles, load |
| `prisma/`                     | schema and migrations (PostGIS)                                                    |
| `data/sample/`                | small real FIRMS sample used by tests and CI                                       |
| `docs/`                       | `METHOD.md`, `PLAN.md`, `DEMO_SCRIPT.md`, `PROJECT_PAGE.md`, `AI_USAGE.md`         |

## Deployment

Production deploys from GitHub Actions after CI passes on `main` (`.github/workflows/deploy.yml`): database migrations, Vercel build and deploy, smoke test, CDN warm-up for the preset areas. Pull requests get a preview deployment with the URL commented on the PR. GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DIRECT_URL`. Data loads run from a laptop: `uv run --project pipeline python -m agni load --database-url "$NEON_DIRECT_URL"`; detection tiles: `node --env-file=.env scripts/upload-tiles.mjs`.

## Data and credits

NASA FIRMS (Fire Information for Resource Management System): MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m Collection 2 (S-NPP, NOAA-20) active-fire products, standard archive + near-real-time. Basemap: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors.

Built with Claude Code (Anthropic): see [`docs/AI_USAGE.md`](docs/AI_USAGE.md).
