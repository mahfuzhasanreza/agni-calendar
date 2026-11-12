import { describe, expect, it } from "vitest";
import { annualBySensor, periodChange } from "@/lib/chart-data";
import type { SeriesPoint } from "@/lib/contracts";
import { monthRange } from "@/lib/months";

function point(month: string, modis: number, viirs: number, harm: number): SeriesPoint {
  return {
    month,
    value: harm,
    low: harm,
    high: harm,
    flag: "observed",
    raw: {
      modisT: modis / 2,
      modisA: modis / 2,
      viirsSnpp: viirs,
      viirsN20: 0,
      naive: month < "2012-02" ? modis : viirs,
    },
    harmonized: harm,
    harmonizedLow: harm * 0.8,
    harmonizedHigh: harm * 1.2,
  };
}

// MODIS sees 10/month, VIIRS 50/month from 2012, harmonized 50/month throughout.
const series = monthRange("2008-07", "2015-12").map((m) =>
  point(m, 10, m >= "2012-01" ? 50 : 0, 50),
);

describe("annualBySensor", () => {
  const rows = annualBySensor(series);
  it("sums each sensor per year and flags partial years", () => {
    const y2010 = rows.find((r) => r.year === 2010)!;
    expect(y2010).toMatchObject({
      modis: 120,
      viirs: null,
      harmonized: 600,
      low: 480,
      high: 720,
      complete: true,
    });
    expect(rows.find((r) => r.year === 2008)!.complete).toBe(false);
    expect(rows.find((r) => r.year === 2013)!.viirs).toBe(600);
  });

  it("the naive record jumps at 2012, the harmonized one does not", () => {
    const naive = periodChange(rows, (r) => r.naive, [2009, 2011], [2013, 2015]);
    const harm = periodChange(rows, (r) => r.harmonized, [2009, 2011], [2013, 2015]);
    expect(naive).toBeCloseTo(5, 5);
    expect(harm).toBeCloseTo(1, 5);
  });

  it("returns null when a period is not fully covered", () => {
    expect(periodChange(rows, (r) => r.modis, [2005, 2007], [2013, 2015])).toBeNull();
  });
});
