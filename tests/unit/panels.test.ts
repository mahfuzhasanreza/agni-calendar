import { describe, expect, it } from "vitest";
import { monthRange } from "@/lib/months";
import { buildPanels, naiveValue, type MonthRow } from "@/lib/stats/panels";

/** Synthetic AOI: MODIS sees 10/month, VIIRS sees 40/month; March burns 5× more. */
function rows(): MonthRow[] {
  return monthRange("2000-11", "2026-11").map((month) => {
    const factor = month.endsWith("-03") ? 5 : 1;
    const viirs = month >= "2012-01";
    return {
      month,
      harm: 40 * factor,
      harmLo: 30 * factor,
      harmHi: 50 * factor,
      modisT: 4 * factor,
      modisA: 6 * factor,
      viirsSnpp: viirs && month <= "2026-11" ? 40 * factor : 0,
      viirsN20: month >= "2018-04" ? 41 * factor : 0,
      flag: month < "2012-02" ? "calibrated" : "observed",
    };
  });
}

const base = {
  start: "2000-11",
  end: "2026-11",
  dataThrough: "2026-11",
  selectedMonth: "2026-03",
  baseline: { from: 2003, to: 2022 },
} as const;

describe("naiveValue", () => {
  it("switches MODIS → S-NPP → NOAA-20", () => {
    const r = { modisT: 1, modisA: 2, viirsSnpp: 10, viirsN20: 20 };
    expect(naiveValue({ month: "2012-01", ...r })).toBe(3);
    expect(naiveValue({ month: "2012-02", ...r })).toBe(10);
    expect(naiveValue({ month: "2026-11", ...r })).toBe(10);
    expect(naiveValue({ month: "2026-12", ...r })).toBe(20);
  });
});

describe("buildPanels", () => {
  it("raw mode shows the 2012 jump, harmonized mode does not", () => {
    const raw = buildPanels(rows(), { ...base, mode: "raw" });
    const harm = buildPanels(rows(), { ...base, mode: "harmonized" });
    const total = (p: typeof raw, y: number) => p.annual.years.find((a) => a.year === y)!.total;
    expect(total(raw, 2013) / total(raw, 2011)).toBeCloseTo(4, 5);
    expect(total(harm, 2013)).toBe(total(harm, 2011));
    expect(harm.annual.trend?.significant).toBe(false);
    expect(raw.annual.trend?.significant).toBe(true);
  });

  it("calendar is years × 12 with nulls outside the data range", () => {
    const p = buildPanels(rows(), { ...base, mode: "harmonized" });
    expect(p.calendar.years[0]).toBe(2000);
    expect(p.calendar.values[0].slice(0, 10)).toEqual(Array(10).fill(null)); // Jan-Oct 2000
    expect(p.calendar.values[0][10]).toBe(40); // Nov 2000
    expect(p.calendar.values.at(-1)![11]).toBeNull(); // Dec 2026 not yet observed
    expect(p.calendar.flags[1][0]).toBe("calibrated");
  });

  it("season profile finds the March peak", () => {
    const p = buildPanels(rows(), { ...base, mode: "harmonized" });
    expect(p.season.months[2]).toMatchObject({ month: 3, median: 200, p10: 200, p90: 200 });
    expect(p.season.months[0].median).toBe(40);
    expect(p.season.selectedYear.year).toBe(2026);
    expect(p.season.selectedYear.values[11]).toBeNull();
  });

  it("anomaly compares the selected month with the same month in baseline years", () => {
    const r = rows().map((x) => (x.month === "2026-03" ? { ...x, harm: 1000 } : x));
    const p = buildPanels(r, { ...base, mode: "harmonized" });
    expect(p.anomaly).toMatchObject({
      month: "2026-03",
      value: 1000,
      median: 200,
      label: "extreme",
      percentileRank: 100,
      ratio: 5,
      baselineYears: 20,
      yearsWithFire: 20,
    });
    expect(p.anomaly.robustZ).toBeNull(); // constant baseline → MAD 0
  });

  it("an AOI with no active cells yields zeros, not errors", () => {
    const p = buildPanels([], { ...base, mode: "harmonized" });
    expect(p.series).toHaveLength(313);
    expect(p.series.every((s) => s.value === 0)).toBe(true);
    expect(p.anomaly.label).toBe("normal");
  });

  it("display range filters the series and calendar but not the baseline", () => {
    const p = buildPanels(rows(), {
      ...base,
      mode: "harmonized",
      start: "2024-01",
      end: "2024-12",
    });
    expect(p.series).toHaveLength(12);
    expect(p.calendar.years).toEqual([2024]);
    expect(p.season.months[2].median).toBe(200); // still from 2003-2022
    expect(p.annual.trend).toBeNull(); // fewer than 4 complete years in range
  });

  it("marks partial years as incomplete", () => {
    const p = buildPanels(rows(), { ...base, mode: "harmonized" });
    const y = (n: number) => p.annual.years.find((a) => a.year === n)!;
    expect(y(2000).complete).toBe(false);
    expect(y(2001).complete).toBe(true);
    expect(y(2026).complete).toBe(false);
    expect(p.annual.trend).toMatchObject({ fromYear: 2003, toYear: 2025 }); // Terra-only years excluded
  });
});
