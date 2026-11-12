const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const monthShort = (m: number) => MONTH_SHORT[m - 1];
export const monthLong = (m: number) => MONTH_LONG[m - 1];

/** "2014-03" → "March 2014". */
export function monthLabel(month: string): string {
  return `${monthLong(Number(month.slice(5, 7)))} ${month.slice(0, 4)}`;
}

/**
 * Hotspot counts. Area-weighted sums can be fractional: one decimal below 10, whole numbers
 * above, thousands separators in full (axis/tooltip style).
 */
export function formatCount(v: number): string {
  if (v !== 0 && Math.abs(v) < 10) {
    return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return Math.round(v).toLocaleString("en-US");
}

export function formatArea(km2: number): string {
  return `${Math.round(km2).toLocaleString("en-US")} km²`;
}
