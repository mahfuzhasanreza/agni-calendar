import "server-only";
import { getDb } from "@/lib/db";
import { densify, FIRE_MAP_FIRST_YEAR, type FireMapData } from "@/lib/fire-map";
import { SNPP_FIRST_FULL_MONTH, SNPP_LAST_MONTH } from "@/lib/sensors";

type Row = { cell_id: number; year: number; harm: number; raw: number };
type Meta = { last_month: string | null; model_version: string | null };

/**
 * Per-cell yearly totals for every ever-active cell (whole region), harmonized and naive raw.
 * The raw rule matches naiveValue() in lib/stats/panels.ts: MODIS Terra + Aqua before S-NPP's
 * first full month, S-NPP through its last month, NOAA-20 after. One scan of cell_month
 * (~0.8 s locally); the route lets the CDN cache the result.
 */
export async function queryFireMap(): Promise<FireMapData> {
  const db = getDb();
  const snppFrom = `${SNPP_FIRST_FULL_MONTH}-01`;
  const snppTo = `${SNPP_LAST_MONTH}-01`;
  const [rows, metaRows, cellRows] = await Promise.all([
    db.$queryRaw<Row[]>`
      SELECT cm.cell_id,
             extract(year FROM cm.month)::int AS year,
             sum(cm.harm)::float8 AS harm,
             sum(CASE
                   WHEN cm.month < ${snppFrom}::date THEN cm.det_modis_t + cm.det_modis_a
                   WHEN cm.month <= ${snppTo}::date THEN cm.det_viirs_snpp
                   ELSE cm.det_viirs_n20
                 END)::float8 AS raw
      FROM cell_month cm
      WHERE cm.month >= ${`${FIRE_MAP_FIRST_YEAR}-01-01`}::date
      GROUP BY 1, 2
      HAVING sum(cm.harm) >= 0.5 OR sum(cm.det_modis_t + cm.det_modis_a + cm.det_viirs_snpp + cm.det_viirs_n20) > 0`,
    db.$queryRaw<Meta[]>`
      SELECT to_char(max(month), 'YYYY-MM') AS last_month,
             (SELECT model_version FROM model_run WHERE is_active LIMIT 1) AS model_version
      FROM cell_month`,
    db.$queryRaw<{ id: number }[]>`SELECT id FROM cell WHERE ever_active ORDER BY id`,
  ]);
  const lastMonth = metaRows[0]?.last_month ?? `${FIRE_MAP_FIRST_YEAR}-12`;
  const lastYear = Number(lastMonth.slice(0, 4));
  const years = Array.from(
    { length: lastYear - FIRE_MAP_FIRST_YEAR + 1 },
    (_, i) => FIRE_MAP_FIRST_YEAR + i,
  );
  const cells = cellRows.map((c) => c.id);
  const dense = densify(
    rows.map((r) => ({ cellId: r.cell_id, year: r.year, harmonized: r.harm, raw: r.raw })),
    cells,
    years,
  );
  return {
    years,
    partialYear: lastMonth.endsWith("-12") ? null : lastYear,
    dataThrough: lastMonth,
    modelVersion: metaRows[0]?.model_version ?? null,
    cells,
    ...dense,
  };
}
