import { analyze } from "@/lib/analyze";
import { attachment, ExportRequest, readExportInput, seriesCsv, slug } from "@/lib/export";
import { findPreset } from "@/lib/regions";

export const maxDuration = 30;

/**
 * GET  /api/export/series?aoi=<AOI JSON>|preset=slug&start=YYYY-MM&end=YYYY-MM
 * POST /api/export/series  { aoi, start, end }
 * Monthly harmonized series (with P10–P90 and every raw sensor) for the area, as CSV.
 */
async function handle(request: Request) {
  let input: unknown;
  try {
    input = await readExportInput(request);
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  const parsed = ExportRequest.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  const result = await analyze({ ...parsed.data, mode: "harmonized" });
  if (!result.ok) return Response.json(result.body, { status: result.status });

  const r = result.body;
  const a = parsed.data.aoi;
  const name = slug(a.type === "preset" ? (findPreset(a.slug)?.name ?? a.slug) : a.type);
  return new Response(seriesCsv(r.series, r.modelVersion), {
    headers: attachment(`agni-monthly-${name}-${r.range.start}-to-${r.range.end}.csv`),
  });
}

export const GET = handle;
export const POST = handle;
