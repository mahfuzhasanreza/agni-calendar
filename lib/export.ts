/** Export request parsing and CSV formatting (pure; shared by the export routes). */
import { z } from "zod";
import { Aoi, Month, type SeriesPoint } from "@/lib/contracts";
import { RECORD_START } from "@/lib/sensors";

export const ExportRequest = z.object({
  aoi: Aoi,
  start: Month.default(RECORD_START),
  end: Month.optional(),
});
export type ExportRequest = z.infer<typeof ExportRequest>;

/** Max rows in one detections download (a whole-region, whole-record export is ~6 M rows). */
export const MAX_DETECTION_ROWS = 500_000;

/** Reads the request from GET query params (aoi = JSON) or a POST JSON body. */
export async function readExportInput(request: Request): Promise<unknown> {
  if (request.method === "POST") return request.json();
  const p = new URL(request.url).searchParams;
  const input: Record<string, unknown> = {};
  const aoi = p.get("aoi");
  const preset = p.get("preset");
  if (aoi) input.aoi = JSON.parse(aoi);
  else if (preset) input.aoi = { type: "preset", slug: preset };
  for (const k of ["start", "end"]) {
    const v = p.get(k);
    if (v) input[k] = v;
  }
  return input;
}

export function firstDay(month: string): string {
  return `${month}-01`;
}

export function lastDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, "0")}`;
}

/** File-name-safe slug, e.g. "Chittagong Hill Tracts (Bangladesh)" → "chittagong-hill-tracts-bangladesh". */
export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "area"
  );
}

export function attachment(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}

export const SERIES_COLUMNS = [
  "month",
  "harmonized_viirs_equivalent",
  "harmonized_p10",
  "harmonized_p90",
  "source_flag",
  "modis_terra_raw",
  "modis_aqua_raw",
  "viirs_snpp_raw",
  "viirs_noaa20_raw",
  "naive_raw",
  "model_version",
] as const;

/** Monthly harmonized series as CSV (area-weighted sums over the AOI's 0.1° cells). */
export function seriesCsv(series: SeriesPoint[], modelVersion: string | null): string {
  const n = (x: number) => String(Math.round(x * 100) / 100);
  const lines = [SERIES_COLUMNS.join(",")];
  for (const p of series) {
    lines.push(
      [
        p.month,
        n(p.harmonized),
        n(p.harmonizedLow),
        n(p.harmonizedHigh),
        p.flag,
        n(p.raw.modisT),
        n(p.raw.modisA),
        n(p.raw.viirsSnpp),
        n(p.raw.viirsN20),
        n(p.raw.naive),
        modelVersion ?? "",
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}
