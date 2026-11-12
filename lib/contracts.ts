/**
 * API contract shared by the route handlers and the UI (docs/PLAN.md §5).
 * Request schemas are validated with Zod; response types are plain TypeScript.
 */
import { z } from "zod";
import { MONTH_RE } from "@/lib/months";

const Lon = z.number().min(-180).max(180);
const Lat = z.number().min(-90).max(90);
export const Month = z.string().regex(MONTH_RE, "expected YYYY-MM");

const Position = z.tuple([Lon, Lat]);
/** GeoJSON Polygon coordinates: outer ring first; holes allowed. */
const PolygonCoordinates = z
  .array(z.array(Position).min(4, "a ring needs at least 4 positions"))
  .min(1)
  .refine((rings) => rings.reduce((n, r) => n + r.length, 0) <= 500, "at most 500 vertices");

export const Aoi = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bbox"), bbox: z.tuple([Lon, Lat, Lon, Lat]) }),
  z.object({ type: z.literal("polygon"), coordinates: PolygonCoordinates }),
  z.object({
    type: z.literal("circle"),
    lat: Lat,
    lon: Lon,
    radiusKm: z.number().min(1).max(200),
  }),
  z.object({ type: z.literal("preset"), slug: z.string().min(1).max(64) }),
]);
export type Aoi = z.infer<typeof Aoi>;

export const AnalyzeRequest = z.object({
  aoi: Aoi,
  /** Display range (inclusive). Baseline statistics always use `baseline`. */
  start: Month.default("2000-11"),
  end: Month.optional(),
  mode: z.enum(["harmonized", "raw"]).default("harmonized"),
  /** Month compared with history; defaults to the latest month with data. */
  selectedMonth: Month.optional(),
  baseline: z
    .object({ from: z.number().int().min(2000), to: z.number().int().max(2100) })
    .refine((b) => b.from <= b.to, "baseline.from must be ≤ baseline.to")
    .default({ from: 2003, to: 2022 }),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequest>;

export type SourceFlag =
  | "observed"
  | "observed_nrt"
  | "calibrated"
  | "terra_only_calibrated"
  | "n20_calibrated"
  | "gap_filled";

export type AnomalyLabel = "below_normal" | "normal" | "above_normal" | "extreme";

export type SeriesPoint = {
  month: string;
  /** Value shown for the current mode (harmonized or raw). */
  value: number;
  low: number | null;
  high: number | null;
  flag: SourceFlag;
  raw: {
    modisT: number;
    modisA: number;
    viirsSnpp: number;
    viirsN20: number;
    /** Naive series: MODIS T+A before S-NPP, S-NPP, then NOAA-20. */
    naive: number;
  };
  harmonized: number;
};

export type MonthStats = {
  month: number;
  median: number;
  mean: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
};

export type AnalyzeResponse = {
  aoi: {
    areaKm2: number;
    cells: number;
    partialCells: number;
    bbox: [number, number, number, number];
    name: string | null;
  };
  modelVersion: string | null;
  mode: "harmonized" | "raw";
  units: string;
  /** Last month with any data, and the exact last day. */
  dataThrough: string;
  dataThroughDate: string;
  /** Latest month fully covered by data (default selected month). */
  latestCompleteMonth: string;
  range: { start: string; end: string };
  baseline: { from: number; to: number };
  series: SeriesPoint[];
  calendar: { years: number[]; values: (number | null)[][]; flags: (SourceFlag | null)[][] };
  season: {
    months: MonthStats[];
    selectedYear: { year: number; values: (number | null)[] };
  };
  anomaly: {
    month: string;
    value: number;
    median: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
    percentileRank: number;
    ratio: number | null;
    robustZ: number | null;
    label: AnomalyLabel;
    baselineYears: number;
    yearsWithFire: number;
  };
  annual: {
    years: {
      year: number;
      total: number;
      low: number | null;
      high: number | null;
      complete: boolean;
    }[];
    trend: {
      method: "sen";
      slopePerYear: number;
      intercept: number;
      mannKendallP: number;
      significant: boolean;
      fromYear: number;
      toYear: number;
    } | null;
  };
  dataSource: string;
};

export type ApiError = { error: string; details?: unknown };
