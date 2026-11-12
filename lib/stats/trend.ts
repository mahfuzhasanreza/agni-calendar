/** Annual trend: Sen's slope with the Mann–Kendall test (two-sided, normal approximation). */
import { median } from "@/lib/stats/descriptive";

/** Standard normal CDF via erf (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  if (z === 0) return 0.5; // exact (the approximation gives 0.5 ± 5e-10)
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Median of pairwise slopes (y_j − y_i) / (x_j − x_i), i < j. */
export function senSlope(xs: readonly number[], ys: readonly number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  if (slopes.length === 0) throw new Error("Sen's slope needs at least two distinct x values");
  return median(slopes);
}

/**
 * Mann–Kendall S statistic, its variance (with the tie correction) and the two-sided p-value
 * using the continuity-corrected normal approximation. Values must be in time order.
 */
export function mannKendall(ys: readonly number[]): {
  s: number;
  varS: number;
  z: number;
  p: number;
} {
  const n = ys.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) s += Math.sign(ys[j] - ys[i]);
  }
  const ties = new Map<number, number>();
  for (const y of ys) ties.set(y, (ties.get(y) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of ties.values()) tieTerm += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  const z =
    varS === 0 ? 0 : s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { s, varS, z, p };
}

/** Sen's slope, intercept (median of y − slope·x) and Mann–Kendall p-value. */
export function senTrend(xs: readonly number[], ys: readonly number[]) {
  const slope = senSlope(xs, ys);
  const intercept = median(xs.map((x, i) => ys[i] - slope * x));
  const { p } = mannKendall(ys);
  return { slope, intercept, p };
}
