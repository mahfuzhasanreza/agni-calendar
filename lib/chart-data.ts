/** Pure data shaping for the charts (unit-tested; no React, no ECharts). */
import type { SeriesPoint } from "@/lib/contracts";
import { yearOf } from "@/lib/months";
import { SNPP_FIRST_FULL_MONTH } from "@/lib/sensors";

export type AnnualSensors = {
  year: number;
  /** MODIS Terra + Aqua, raw counts. */
  modis: number;
  /** VIIRS S-NPP raw counts (null before the first full S-NPP year). */
  viirs: number | null;
  /** Naive record: MODIS until S-NPP starts, then S-NPP, then NOAA-20 (shows the jump). */
  naive: number;
  harmonized: number;
  low: number;
  high: number;
  complete: boolean;
};

const round = (x: number) => Math.round(x);

/**
 * Annual totals per sensor from the monthly series. Only years with all 12 months are
 * "complete"; S-NPP is reported from its first full year (2012-02 start → 2013+ complete,
 * 2012 shown but marked partial for VIIRS).
 */
export function annualBySensor(series: SeriesPoint[]): AnnualSensors[] {
  const byYear = new Map<number, SeriesPoint[]>();
  for (const p of series) {
    const y = yearOf(p.month);
    const list = byYear.get(y) ?? [];
    list.push(p);
    byYear.set(y, list);
  }
  const snppStartYear = yearOf(SNPP_FIRST_FULL_MONTH);
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, pts]) => {
      const sum = (f: (p: SeriesPoint) => number) => round(pts.reduce((a, p) => a + f(p), 0));
      return {
        year,
        modis: sum((p) => p.raw.modisT + p.raw.modisA),
        viirs: year >= snppStartYear ? sum((p) => p.raw.viirsSnpp) : null,
        naive: sum((p) => p.raw.naive),
        harmonized: sum((p) => p.harmonized),
        low: sum((p) => p.harmonizedLow),
        high: sum((p) => p.harmonizedHigh),
        complete: pts.length === 12,
      };
    });
}

/**
 * Ratio of the mean over `after` to the mean over `before` (complete years only), e.g. the
 * 2009-11 → 2012-14 change. Null when a period is not fully covered.
 */
export function periodChange(
  rows: AnnualSensors[],
  value: (r: AnnualSensors) => number,
  before: [number, number],
  after: [number, number],
): number | null {
  const mean = ([a, b]: [number, number]) => {
    const xs = rows.filter((r) => r.complete && r.year >= a && r.year <= b).map(value);
    return xs.length === b - a + 1 ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  const m0 = mean(before);
  const m1 = mean(after);
  return m0 && m1 !== null ? m1 / m0 : null;
}
