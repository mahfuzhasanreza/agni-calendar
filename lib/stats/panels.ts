/**
 * Turns the AOI monthly rows from SQL into every panel of the analyze response:
 * series, calendar, season profile, anomaly and annual totals + trend.
 * Pure function (no database), so it is fully unit-tested.
 */
import type { AnalyzeResponse, MonthStats, SeriesPoint, SourceFlag } from "@/lib/contracts";
import { calendarMonthOf, monthIndex, monthFromIndex, monthRange, yearOf } from "@/lib/months";
import {
  RECORD_START,
  SNPP_FIRST_FULL_MONTH,
  SNPP_LAST_MONTH,
  TREND_START_YEAR,
} from "@/lib/sensors";
import {
  anomalyLabel,
  mean,
  median,
  percentileRank,
  quantile,
  robustZ,
} from "@/lib/stats/descriptive";
import { senTrend } from "@/lib/stats/trend";

/** One row per month from SQL (area-weighted sums over the AOI cells). */
export type MonthRow = {
  month: string;
  harm: number;
  harmLo: number;
  harmHi: number;
  modisT: number;
  modisA: number;
  viirsSnpp: number;
  viirsN20: number;
  flag: SourceFlag;
};

export type PanelOptions = {
  mode: "harmonized" | "raw";
  start: string;
  end: string;
  dataThrough: string;
  selectedMonth: string;
  baseline: { from: number; to: number };
};

type Panels = Pick<AnalyzeResponse, "series" | "calendar" | "season" | "anomaly" | "annual">;

/** Naive "raw" value: the sensor a non-harmonized record would use for that month. */
export function naiveValue(
  row: Pick<MonthRow, "month" | "modisT" | "modisA" | "viirsSnpp" | "viirsN20">,
): number {
  const i = monthIndex(row.month);
  if (i < monthIndex(SNPP_FIRST_FULL_MONTH)) return row.modisT + row.modisA;
  if (i <= monthIndex(SNPP_LAST_MONTH)) return row.viirsSnpp;
  return row.viirsN20;
}

const round = (x: number, digits = 2) => Math.round(x * 10 ** digits) / 10 ** digits;

function stats(values: number[], month: number): MonthStats {
  if (values.length === 0) return { month, median: 0, mean: 0, p10: 0, p25: 0, p75: 0, p90: 0 };
  return {
    month,
    median: round(median(values)),
    mean: round(mean(values)),
    p10: round(quantile(values, 0.1)),
    p25: round(quantile(values, 0.25)),
    p75: round(quantile(values, 0.75)),
    p90: round(quantile(values, 0.9)),
  };
}

export function buildPanels(rows: MonthRow[], opt: PanelOptions): Panels {
  const harmonized = opt.mode === "harmonized";
  const byMonth = new Map(rows.map((r) => [r.month, r]));

  // Full record, zero-filled (an AOI with no active cells has no rows at all).
  const full: SeriesPoint[] = monthRange(RECORD_START, opt.dataThrough).map((month) => {
    const r = byMonth.get(month) ?? {
      month,
      harm: 0,
      harmLo: 0,
      harmHi: 0,
      modisT: 0,
      modisA: 0,
      viirsSnpp: 0,
      viirsN20: 0,
      flag: "observed" as const,
    };
    const naive = naiveValue(r);
    return {
      month,
      value: round(harmonized ? r.harm : naive),
      low: harmonized ? round(r.harmLo) : null,
      high: harmonized ? round(r.harmHi) : null,
      flag: r.flag,
      raw: {
        modisT: round(r.modisT),
        modisA: round(r.modisA),
        viirsSnpp: round(r.viirsSnpp),
        viirsN20: round(r.viirsN20),
        naive: round(naive),
      },
      harmonized: round(r.harm),
      harmonizedLow: round(r.harmLo),
      harmonizedHigh: round(r.harmHi),
    };
  });
  const point = new Map(full.map((p) => [p.month, p]));
  const valueAt = (month: string): number | null => point.get(month)?.value ?? null;

  const startI = Math.max(monthIndex(opt.start), monthIndex(RECORD_START));
  const endI = Math.min(monthIndex(opt.end), monthIndex(opt.dataThrough));
  const series = full.filter((p) => {
    const i = monthIndex(p.month);
    return i >= startI && i <= endI;
  });

  // Calendar: years × 12 over the display range; null outside it.
  const years: number[] = [];
  for (let y = Math.floor(startI / 12); y <= Math.floor(endI / 12); y++) years.push(y);
  const inRange = (month: string) => {
    const i = monthIndex(month);
    return i >= startI && i <= endI;
  };
  const calendar = {
    years,
    values: years.map((y) =>
      Array.from({ length: 12 }, (_, m) => {
        const month = monthFromIndex(y * 12 + m);
        return inRange(month) ? valueAt(month) : null;
      }),
    ),
    flags: years.map((y) =>
      Array.from({ length: 12 }, (_, m) => {
        const month = monthFromIndex(y * 12 + m);
        return inRange(month) ? (point.get(month)?.flag ?? null) : null;
      }),
    ),
  };

  // Baseline sample for calendar month m (1-12), optionally excluding one year.
  const baselineValues = (m: number, excludeYear?: number): number[] => {
    const out: number[] = [];
    for (let y = opt.baseline.from; y <= opt.baseline.to; y++) {
      if (y === excludeYear) continue;
      const v = valueAt(monthFromIndex(y * 12 + m - 1));
      if (v !== null) out.push(v);
    }
    return out;
  };

  const selectedYear = yearOf(opt.selectedMonth);
  const season = {
    months: Array.from({ length: 12 }, (_, i) => stats(baselineValues(i + 1), i + 1)),
    selectedYear: {
      year: selectedYear,
      values: Array.from({ length: 12 }, (_, m) => valueAt(monthFromIndex(selectedYear * 12 + m))),
    },
  };

  // Anomaly: the selected month against the same calendar month in the baseline years
  // (excluding the selected year itself, so a month is never compared with itself).
  const selM = calendarMonthOf(opt.selectedMonth);
  const sample = baselineValues(selM, selectedYear);
  const x = valueAt(opt.selectedMonth) ?? 0;
  const q = stats(sample, selM);
  const anomaly = {
    month: opt.selectedMonth,
    value: x,
    median: q.median,
    p10: q.p10,
    p25: q.p25,
    p75: q.p75,
    p90: q.p90,
    percentileRank: sample.length ? round(percentileRank(x, sample), 1) : 50,
    ratio: q.median > 0 ? round(x / q.median) : null,
    robustZ: sample.length
      ? (() => {
          const z = robustZ(x, sample);
          return z === null ? null : round(z);
        })()
      : null,
    label: sample.length ? anomalyLabel(x, q) : ("normal" as const),
    baselineYears: sample.length,
    yearsWithFire: sample.filter((v) => v > 0).length,
  };

  // Annual totals over the full record; a year is complete when all 12 months have data.
  const firstYear = yearOf(RECORD_START);
  const lastYear = yearOf(opt.dataThrough);
  const annualYears = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const pts = full.filter((p) => yearOf(p.month) === y);
    annualYears.push({
      year: y,
      total: round(pts.reduce((a, p) => a + p.value, 0)),
      low: harmonized ? round(pts.reduce((a, p) => a + (p.low ?? 0), 0)) : null,
      high: harmonized ? round(pts.reduce((a, p) => a + (p.high ?? 0), 0)) : null,
      complete: pts.length === 12,
    });
  }
  const trendYears = annualYears.filter(
    (a) =>
      a.complete &&
      a.year >= Math.max(Math.floor(startI / 12), TREND_START_YEAR) &&
      a.year <= Math.floor(endI / 12),
  );
  let trend: Panels["annual"]["trend"] = null;
  if (trendYears.length >= 4) {
    const t = senTrend(
      trendYears.map((a) => a.year),
      trendYears.map((a) => a.total),
    );
    trend = {
      method: "sen",
      slopePerYear: round(t.slope),
      intercept: round(t.intercept),
      mannKendallP: round(t.p, 4),
      significant: t.p < 0.05,
      fromYear: trendYears[0].year,
      toYear: trendYears[trendYears.length - 1].year,
    };
  }

  return { series, calendar, season, anomaly, annual: { years: annualYears, trend } };
}
