import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { buildHealthReport, httpStatusFor, type HealthProbe } from "@/lib/health";

// Node.js is the default (and only non-deprecated) runtime. Next 16 with `cacheComponents`
// rejects an explicit `export const runtime`, so it is intentionally not set here.
export const maxDuration = 10;

type ProbeRow = { postgis: string | null; active_model: string | null; latest_ingest: Date | null };

async function probeDatabase(): Promise<HealthProbe> {
  const started = performance.now();
  const rows = await getDb().$queryRaw<ProbeRow[]>`
    SELECT
      (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis,
      (SELECT model_version FROM model_run WHERE is_active LIMIT 1) AS active_model,
      (SELECT max(finished_at) FROM ingest_run WHERE status = 'success') AS latest_ingest
  `;
  const row = rows[0];
  return {
    latencyMs: performance.now() - started,
    postgis: row?.postgis ?? null,
    activeModel: row?.active_model ?? null,
    latestIngest: row?.latest_ingest ?? null,
  };
}

/** GET /api/health: database connectivity, PostGIS version, active model, latest ingest. */
export async function GET() {
  // Always run at request time: never query the database during `next build`.
  await connection();

  let probe: HealthProbe | Error;
  try {
    probe = await probeDatabase();
  } catch (error) {
    console.error("[health] database probe failed:", error);
    probe = error instanceof Error ? error : new Error(String(error));
  }

  const report = buildHealthReport(probe);
  return Response.json(report, {
    status: httpStatusFor(report),
    headers: { "Cache-Control": "no-store" },
  });
}
