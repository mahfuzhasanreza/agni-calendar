import "server-only";
import { AoiError, resolveAoi } from "@/lib/aoi";
import { AnalyzeRequest, type AnalyzeResponse, type ApiError } from "@/lib/contracts";
import { latestCompleteMonth, monthIndex } from "@/lib/months";
import { DATA_SOURCE, UNITS } from "@/lib/sensors";
import { queryAoiMeta, queryAoiSeries, queryStatus } from "@/lib/sql/analyze";
import { buildPanels } from "@/lib/stats/panels";

export type AnalyzeResult =
  { ok: true; body: AnalyzeResponse } | { ok: false; status: number; body: ApiError };

/** Validates the request, runs the AOI queries and assembles every panel. */
export async function analyze(input: unknown): Promise<AnalyzeResult> {
  const parsed = AnalyzeRequest.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid request",
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    };
  }
  const req = parsed.data;

  let aoi;
  try {
    aoi = resolveAoi(req.aoi);
  } catch (e) {
    if (e instanceof AoiError) return { ok: false, status: 400, body: { error: e.message } };
    throw e;
  }

  const [status, meta, rows] = await Promise.all([
    queryStatus(),
    queryAoiMeta(aoi),
    queryAoiSeries(aoi),
  ]);
  if (!status.lastDate) {
    return { ok: false, status: 503, body: { error: "no data has been loaded yet" } };
  }
  const dataThrough = status.lastDate.slice(0, 7);
  const latestComplete = latestCompleteMonth(status.lastDate);

  const end = req.end ?? dataThrough;
  if (monthIndex(req.start) > monthIndex(end)) {
    return { ok: false, status: 400, body: { error: "start must not be after end" } };
  }
  const selectedMonth =
    req.selectedMonth && monthIndex(req.selectedMonth) <= monthIndex(dataThrough)
      ? req.selectedMonth
      : latestComplete;

  const panels = buildPanels(rows, {
    mode: req.mode,
    start: req.start,
    end,
    dataThrough,
    selectedMonth,
    baseline: req.baseline,
  });

  return {
    ok: true,
    body: {
      aoi: { ...meta, areaKm2: Math.round(meta.areaKm2), bbox: aoi.bbox, name: aoi.name },
      modelVersion: status.modelVersion,
      mode: req.mode,
      units: UNITS[req.mode],
      dataThrough,
      dataThroughDate: status.lastDate,
      latestCompleteMonth: latestComplete,
      range: { start: req.start, end },
      baseline: req.baseline,
      ...panels,
      dataSource: DATA_SOURCE,
    },
  };
}
