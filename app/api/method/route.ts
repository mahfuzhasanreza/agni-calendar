import { connection } from "next/server";
import { getDb } from "@/lib/db";

export const maxDuration = 10;

type Row = {
  model_version: string;
  metric: string;
  method: string;
  grid_res: number;
  calib_from: number;
  calib_to: number;
  metrics: unknown;
  cv_predictions: unknown;
  notes: string | null;
  created_at: Date;
};

/**
 * GET /api/method: the active calibration model, its validation report (all candidate models,
 * all levels) and the held-out predictions for the Method page.
 */
export async function GET() {
  await connection();
  const rows = await getDb().$queryRaw<Row[]>`
    SELECT model_version, metric, method, grid_res, calib_from, calib_to, metrics,
           cv_predictions, notes, created_at
    FROM model_run WHERE is_active LIMIT 1`;
  const row = rows[0];
  if (!row) {
    return Response.json({ error: "no active model" }, { status: 503 });
  }
  return Response.json(
    {
      modelVersion: row.model_version,
      metric: row.metric,
      method: row.method,
      gridRes: row.grid_res,
      calibration: { from: row.calib_from, to: row.calib_to },
      notes: row.notes,
      createdAt: row.created_at,
      report: row.metrics,
      cvPredictions: row.cv_predictions,
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
