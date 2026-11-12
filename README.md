# Agni (অগ্নি)

**25 years of fire history, one consistent calendar.**

Agni turns 25 years of NASA MODIS and VIIRS active-fire hotspots into a single, sensor-independent burning calendar for any area in Bangladesh, Northeast India and western Myanmar, with anomaly labels and downloadable evidence. Built for the NASA Space Apps Challenge 2026, challenge "Harmonization of MODIS and VIIRS Hot Spots".

> Status: hackathon in progress. See [`docs/PLAN.md`](docs/PLAN.md) for the implementation plan.

## Stack

Next.js (App Router, TypeScript) on Vercel · Neon Postgres + PostGIS · Python pipeline (pandas, scipy) · GitHub Actions.

## Local development

Requirements: Node 26 (`.nvmrc`), pnpm 9, Python 3.12, Docker (from M2).

```bash
pnpm install
cp .env.example .env   # fill in the values
pnpm dev               # http://localhost:3000
```

Checks (the same ones CI runs):

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

## Data pipeline

Requires [uv](https://docs.astral.sh/uv/). From the repo root:

```bash
pnpm db:up                                              # local PostGIS
pnpm db:deploy                                          # apply migrations
uv run --project pipeline python -m agni all            # data/raw → parquet, tiles, local DB (~1 min)
uv run --project pipeline python -m agni all --raw data/sample --kind sample   # quick run on the sample
cd pipeline && uv run pytest                            # tests (set AGNI_TEST_DATABASE_URL for DB tests)
```

## Data

NASA FIRMS archive downloads (MODIS C6.1, VIIRS S-NPP and NOAA-20, bbox 86,20,97,28) go in `data/raw/` (git-ignored). Details: `CLAUDE.md` §4.

## Deployment

Production deploys run from GitHub Actions after CI passes on `main` (`.github/workflows/deploy.yml`). Pull requests get a preview deployment with the URL commented on the PR. Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Credits

Data: NASA FIRMS (MODIS Collection 6.1, VIIRS 375 m Collection 2). Built with Claude Code; see [`docs/AI_USAGE.md`](docs/AI_USAGE.md).
