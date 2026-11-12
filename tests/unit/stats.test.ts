import { describe, expect, it } from "vitest";
import {
  anomalyLabel,
  mad,
  mean,
  median,
  percentileRank,
  quantile,
  robustZ,
} from "@/lib/stats/descriptive";
import { mannKendall, normalCdf, senSlope, senTrend } from "@/lib/stats/trend";

// Reference values computed with numpy (np.quantile default = type 7).
const sample = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];

describe("quantile (type 7, same as numpy)", () => {
  it.each([
    [0, 1],
    [0.1, 1],
    [0.25, 2.25],
    [0.5, 3.5],
    [0.75, 5],
    [0.9, 6.3],
    [1, 9],
  ])("p=%s → %s", (p, expected) => {
    expect(quantile(sample, p)).toBeCloseTo(expected, 10);
  });

  it("does not mutate its input and rejects bad input", () => {
    const copy = [...sample];
    quantile(sample, 0.5);
    expect(sample).toEqual(copy);
    expect(() => quantile([], 0.5)).toThrow();
    expect(() => quantile(sample, 1.5)).toThrow();
  });

  it("handles a single value", () => {
    expect(quantile([7], 0.9)).toBe(7);
  });
});

describe("descriptive statistics", () => {
  it("mean, median, MAD", () => {
    expect(mean(sample)).toBe(3.9);
    expect(median(sample)).toBe(3.5);
    expect(mad(sample)).toBe(1.5);
  });

  it("percentile rank counts ties as half", () => {
    expect(percentileRank(5, sample)).toBe(70); // 6 below, 2 equal → (6 + 0.5·2) / 10
    expect(percentileRank(0, sample)).toBe(0);
    expect(percentileRank(100, sample)).toBe(100);
    expect(percentileRank(0, [0, 0, 0, 0])).toBe(50);
  });

  it("robust z is null when MAD is 0", () => {
    expect(robustZ(5, sample)).toBeCloseTo((5 - 3.5) / (1.4826 * 1.5), 10);
    expect(robustZ(3, [0, 0, 0, 0])).toBeNull();
  });
});

describe("anomalyLabel (CLAUDE.md §5.7 thresholds)", () => {
  const q = { p25: 10, p75: 20, p90: 30 };
  it.each([
    [9, "below_normal"],
    [10, "normal"],
    [20, "normal"],
    [21, "above_normal"],
    [30, "above_normal"],
    [31, "extreme"],
  ])("%s → %s", (x, label) => {
    expect(anomalyLabel(x, q)).toBe(label);
  });

  it("any fire in a month that never burned is extreme (Sundarbans case)", () => {
    expect(anomalyLabel(1, { p25: 0, p75: 0, p90: 0 })).toBe("extreme");
    expect(anomalyLabel(0, { p25: 0, p75: 0, p90: 0 })).toBe("normal");
  });
});

describe("trend (reference values computed in Python)", () => {
  it("normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4);
  });

  it("Mann–Kendall on a monotonic series", () => {
    const r = mannKendall([1, 2, 3, 4, 5]);
    expect(r.s).toBe(10);
    expect(r.varS).toBeCloseTo(16.6667, 4);
    expect(r.z).toBeCloseTo(2.20454, 5);
    expect(r.p).toBeCloseTo(0.027486, 5);
  });

  it("Mann–Kendall with ties and a decreasing tendency", () => {
    const r = mannKendall([3, 3, 1, 2, 2]);
    expect(r.s).toBe(-4);
    expect(r.varS).toBeCloseTo(14.6667, 4);
    expect(r.p).toBeCloseTo(0.433422, 5);
  });

  it("Mann–Kendall on a constant series is not significant", () => {
    expect(mannKendall([5, 5, 5, 5]).p).toBe(1);
  });

  it("Sen's slope and intercept", () => {
    const x = [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008];
    const y = [10, 12, 11, 15, 14, 18, 17, 20];
    expect(senSlope(x, y)).toBe(1.5);
    const t = senTrend(x, y);
    expect(t.intercept).toBeCloseTo(-2991.75, 6);
    expect(t.p).toBeCloseTo(0.009375, 5);
  });
});
