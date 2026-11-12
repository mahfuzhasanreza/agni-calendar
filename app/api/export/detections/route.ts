import { AoiError, resolveAoi } from "@/lib/aoi";
import {
  attachment,
  ExportRequest,
  firstDay,
  lastDay,
  MAX_DETECTION_ROWS,
  readExportInput,
  slug,
} from "@/lib/export";
import { aoiContains } from "@/lib/geo";
import { exportDetections, getManifest } from "@/lib/tiles";

export const maxDuration = 60;

/**
 * GET  /api/export/detections?aoi=<GeoJSON-ish AOI JSON>|preset=slug&start=YYYY-MM&end=YYYY-MM
 * POST /api/export/detections  { aoi, start, end }
 * Streams every FIRMS vegetation-fire detection (all confidence levels; `qualified` = 1 for
 * the ones used in the analysis) inside the area and month range, as CSV.
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
    return Response.json(
      {
        error: "invalid request",
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }
  const req = parsed.data;
  let aoi;
  try {
    aoi = resolveAoi(req.aoi);
  } catch (e) {
    if (e instanceof AoiError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }

  let manifest;
  try {
    manifest = await getManifest();
  } catch (e) {
    console.error("[export] tiles unavailable:", e);
    return Response.json({ error: "detection files are not available right now" }, { status: 503 });
  }
  const end =
    req.end ?? manifest.tiles.reduce((m, t) => (t.date_max > m ? t.date_max : m), "").slice(0, 7);
  if (req.start > end)
    return Response.json({ error: "start must not be after end" }, { status: 400 });

  const lines = exportDetections({
    bbox: aoi.bbox,
    contains: aoiContains(aoi),
    startDate: firstDay(req.start),
    endDate: lastDay(end),
    maxRows: MAX_DETECTION_ROWS,
  });
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await lines.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value + "\n"));
      } catch (e) {
        console.error("[export] stream failed:", e);
        controller.error(e);
      }
    },
    async cancel() {
      await lines.return(undefined);
    },
  });
  const name = slug(aoi.name ?? req.aoi.type);
  return new Response(body, {
    headers: attachment(`agni-detections-${name}-${req.start}-to-${end}.csv`),
  });
}

export const GET = handle;
export const POST = handle;
