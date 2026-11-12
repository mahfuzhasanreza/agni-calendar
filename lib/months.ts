/** Months are "YYYY-MM" strings in the API and integer indexes (year * 12 + month - 1) inside. */

export const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function monthIndex(month: string): number {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`invalid month "${month}" (expected YYYY-MM)`);
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

export function monthFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function yearOf(month: string): number {
  return Number(month.slice(0, 4));
}

/** Calendar month 1-12. */
export function calendarMonthOf(month: string): number {
  return Number(month.slice(5, 7));
}

/**
 * Latest month fully covered by data ending on lastDate ("YYYY-MM-DD"): that month if
 * lastDate is its final day, otherwise the month before.
 */
export function latestCompleteMonth(lastDate: string): string {
  const [y, m, d] = lastDate.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const month = lastDate.slice(0, 7);
  return d === daysInMonth ? month : monthFromIndex(monthIndex(month) - 1);
}

/** Inclusive list of months from start to end. */
export function monthRange(start: string, end: string): string[] {
  const a = monthIndex(start);
  const b = monthIndex(end);
  const out: string[] = [];
  for (let i = a; i <= b; i++) out.push(monthFromIndex(i));
  return out;
}
