import "server-only";
import type { ResolvedAoi } from "@/lib/aoi";
import type { SourceFlag } from "@/lib/contracts";
import { getDb } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { MonthRow } from "@/lib/stats/panels";

/** Ranks so that a month's flag is the "least observed" one among its cells. */
const FLAG_BY_RANK: SourceFlag[] = [
  "observed",
  "observed_nrt",
  "calibrated",
  "n20_calibrated",
  "terra_only_calibrated",
  "gap_filled",
];

function aoiGeometry(aoi: ResolvedAoi): Prisma.Sql {
  if (aoi.kind === "circle") {
    return Prisma.sql`ST_Buffer(
      ST_SetSRID(ST_MakePoint(${aoi.lon}, ${aoi.lat}), 4326)::geography,
      ${aoi.radiusKm * 1000}
    )::geometry`;
  }
  return Prisma.sql`ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${aoi.geojson}), 4326))`;
}

type SeriesRow = {
  month: string;
  harm: number;
  harm_lo: number;
  harm_hi: number;
  modis_t: number;
  modis_a: number;
  viirs_snpp: number;
  viirs_n20: number;
  flag_rank: number;
};

type MetaRow = { area_km2: number; cells: number; partial_cells: number };
type StatusRow = { model_version: string | null; last_date: string | null };

/** Same ranking as FLAG_RANK_SQL in pipeline/agni/load.py (used to build tile_month). */
const FLAG_RANK = Prisma.sql`CASE cm.source_flag
  WHEN 'gap_filled' THEN 5 WHEN 'terra_only_calibrated' THEN 4
  WHEN 'n20_calibrated' THEN 3 WHEN 'calibrated' THEN 2
  WHEN 'observed_nrt' THEN 1 ELSE 0 END`;

/**
 * Monthly AOI series: area-weighted sums over the grid cells that intersect the AOI.
 * Fully covered cells weigh 1; partially covered cells weigh their covered fraction.
 *
 * Speed-up: 1° tiles fully inside the AOI are read from the tile_month rollup (313 rows per
 * tile instead of ~30,000 cell-months); only tiles crossed by the AOI boundary go cell by
 * cell. Both paths give the same sums (tile_month = cell_month summed per tile).
 */
export async function queryAoiSeries(aoi: ResolvedAoi): Promise<MonthRow[]> {
  const rows = await getDb().$queryRaw<SeriesRow[]>`
    WITH aoi AS (SELECT ${aoiGeometry(aoi)} AS g),
    tiles AS MATERIALIZED (
      SELECT t.id, ST_CoveredBy(t.geom, aoi.g) AS full_cover
      FROM tile t, aoi
      WHERE ST_Intersects(t.geom, aoi.g)
    ),
    -- MATERIALIZED: compute each cell's weight once (inlining recomputed it per cell-month row).
    -- Cells of boundary tiles, picked by tile_id (~100 per tile); the intersection test lives
    -- in the weight so each cell is tested once (a spatial-index probe per tile was 20× slower).
    cells AS MATERIALIZED (
      SELECT c.id,
        CASE WHEN NOT ST_Intersects(c.geom, aoi.g) THEN 0.0::float8
             WHEN ST_CoveredBy(c.geom, aoi.g) THEN 1.0::float8
             ELSE ST_Area(ST_Intersection(c.geom, aoi.g)) / ST_Area(c.geom) END AS w
      FROM tiles
      JOIN cell c ON c.tile_id = tiles.id
      CROSS JOIN aoi
      WHERE NOT tiles.full_cover AND c.ever_active
    ),
    parts AS (
      SELECT tm.month, tm.harm::float8 AS harm, tm.harm_lo::float8 AS harm_lo,
        tm.harm_hi::float8 AS harm_hi, tm.det_modis_t::float8 AS modis_t,
        tm.det_modis_a::float8 AS modis_a, tm.det_viirs_snpp::float8 AS viirs_snpp,
        tm.det_viirs_n20::float8 AS viirs_n20, tm.flag_rank::int AS flag_rank
      FROM tiles JOIN tile_month tm ON tm.tile_id = tiles.id
      WHERE tiles.full_cover
      UNION ALL
      SELECT cm.month, cm.harm * w, cm.harm_lo * w, cm.harm_hi * w, cm.det_modis_t * w,
        cm.det_modis_a * w, cm.det_viirs_snpp * w, cm.det_viirs_n20 * w, ${FLAG_RANK}
      FROM cells JOIN cell_month cm ON cm.cell_id = cells.id
      WHERE cells.w > 0
    )
    SELECT to_char(month, 'YYYY-MM') AS month,
      sum(harm)::float8 AS harm, sum(harm_lo)::float8 AS harm_lo, sum(harm_hi)::float8 AS harm_hi,
      sum(modis_t)::float8 AS modis_t, sum(modis_a)::float8 AS modis_a,
      sum(viirs_snpp)::float8 AS viirs_snpp, sum(viirs_n20)::float8 AS viirs_n20,
      max(flag_rank)::int AS flag_rank
    FROM parts
    GROUP BY month
    ORDER BY month`;
  return rows.map((r) => ({
    month: r.month,
    harm: r.harm,
    harmLo: r.harm_lo,
    harmHi: r.harm_hi,
    modisT: r.modis_t,
    modisA: r.modis_a,
    viirsSnpp: r.viirs_snpp,
    viirsN20: r.viirs_n20,
    flag: FLAG_BY_RANK[r.flag_rank] ?? "observed",
  }));
}

/** AOI area (km², geodesic), number of grid cells touched and how many are partial. */
export async function queryAoiMeta(aoi: ResolvedAoi) {
  const [row] = await getDb().$queryRaw<MetaRow[]>`
    WITH aoi AS (SELECT ${aoiGeometry(aoi)} AS g),
    tiles AS MATERIALIZED (
      SELECT t.id, ST_CoveredBy(t.geom, aoi.g) AS full_cover
      FROM tile t, aoi
      WHERE ST_Intersects(t.geom, aoi.g)
    ),
    edge AS MATERIALIZED (
      SELECT c.geom FROM tiles JOIN cell c ON c.tile_id = tiles.id WHERE NOT tiles.full_cover
    ),
    hit AS (
      SELECT ST_CoveredBy(edge.geom, aoi.g) AS full_cover
      FROM edge CROSS JOIN aoi
      WHERE ST_Intersects(edge.geom, aoi.g) AND ST_Area(ST_Intersection(edge.geom, aoi.g)) > 0
    )
    SELECT (SELECT ST_Area(g::geography) / 1e6 FROM aoi)::float8 AS area_km2,
      ((SELECT count(*) FROM cell c JOIN tiles ON tiles.id = c.tile_id AND tiles.full_cover)
        + (SELECT count(*) FROM hit))::int AS cells,
      (SELECT count(*) FROM hit WHERE NOT full_cover)::int AS partial_cells`;
  return { areaKm2: row.area_km2, cells: row.cells, partialCells: row.partial_cells };
}

/** Active model version and the last day with data (from the latest successful load). */
export async function queryStatus() {
  const [row] = await getDb().$queryRaw<StatusRow[]>`
    SELECT
      (SELECT model_version FROM model_run WHERE is_active LIMIT 1) AS model_version,
      (SELECT to_char(max(data_to), 'YYYY-MM-DD') FROM ingest_run WHERE status = 'success')
        AS last_date`;
  return { modelVersion: row.model_version, lastDate: row.last_date };
}
