/** Descriptive statistics used by the anomaly and season panels (CLAUDE.md §5.7). */
import type { AnomalyLabel } from "@/lib/contracts";

function sorted(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Quantile with linear interpolation between closest ranks (Hyndman & Fan type 7), the
 * default of numpy.quantile and R, so pipeline and app agree. `p` in [0, 1].
 */
export function quantile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new Error("quantile of an empty sample");
  if (p < 0 || p > 1) throw new Error("p must be in [0, 1]");
  const s = sorted(values);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export const median = (values: readonly number[]): number => quantile(values, 0.5);

export function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error("mean of an empty sample");
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Median absolute deviation (unscaled). */
export function mad(values: readonly number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/**
 * Percentile rank of x within the sample, 0-100, counting ties as half
 * ("mid-rank"): 100 · (#below + 0.5 · #equal) / n.
 */
export function percentileRank(x: number, values: readonly number[]): number {
  if (values.length === 0) throw new Error("percentile rank against an empty sample");
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < x) below++;
    else if (v === x) equal++;
  }
  return (100 * (below + 0.5 * equal)) / values.length;
}

/** Robust z-score (x − median) / (1.4826 · MAD); null when MAD is 0. */
export function robustZ(x: number, values: readonly number[]): number | null {
  const d = mad(values);
  return d === 0 ? null : (x - median(values)) / (1.4826 * d);
}

/**
 * Anomaly label from baseline quantiles (CLAUDE.md §5.7):
 *   x < P25 below normal · P25 ≤ x ≤ P75 normal · P75 < x ≤ P90 above normal · x > P90 extreme
 * A fire in a month that never burned in the baseline (P90 = 0, x > 0) is therefore extreme.
 */
export function anomalyLabel(
  x: number,
  q: { p25: number; p75: number; p90: number },
): AnomalyLabel {
  if (x > q.p90) return "extreme";
  if (x > q.p75) return "above_normal";
  if (x < q.p25) return "below_normal";
  return "normal";
}
