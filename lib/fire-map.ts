/**
 * The 3D fire map: per-cell yearly hotspot totals for the whole loaded region, drawn as
 * extruded 0.1° columns. Pure helpers shared by the API route (server) and the map (client).
 */
import { heatClasses, HEAT_RAMP, type HeatClass } from "@/lib/colors";
import { site } from "@/lib/site";

/** Grid: cell id = row * 10000 + col, row 0 at the southern edge (pipeline/agni/grid.py). */
export const GRID_RES = 0.1;
export const ID_FACTOR = 10_000;
/** First full calendar year of the record (Nov–Dec 2000 is too short to show as a year). */
export const FIRE_MAP_FIRST_YEAR = 2001;

export type FireMapData = {
  years: number[];
  /** The last year when it is not complete yet (data through dataThrough), else null. */
  partialYear: number | null;
  /** Last month with data, YYYY-MM. */
  dataThrough: string;
  modelVersion: string | null;
  /** Ever-active cell ids. */
  cells: number[];
  /** [yearIndex][cellIndex]: harmonized hotspots per year (VIIRS S-NPP-equivalent), rounded. */
  harmonized: number[][];
  /** [yearIndex][cellIndex]: naive raw hotspots per year (sensor available at the time). */
  raw: number[][];
};

export type FireMapRow = { cellId: number; year: number; harmonized: number; raw: number };

/** Dense per-year arrays from sparse (cell, year) rows; cells without a row count 0. */
export function densify(
  rows: FireMapRow[],
  cells: number[],
  years: number[],
): Pick<FireMapData, "harmonized" | "raw"> {
  const cellIndex = new Map(cells.map((id, i) => [id, i]));
  const harmonized = years.map(() => new Array<number>(cells.length).fill(0));
  const raw = years.map(() => new Array<number>(cells.length).fill(0));
  const y0 = years[0];
  for (const r of rows) {
    const yi = r.year - y0;
    const ci = cellIndex.get(r.cellId);
    if (ci === undefined || yi < 0 || yi >= years.length) continue;
    harmonized[yi][ci] = Math.round(r.harmonized);
    raw[yi][ci] = Math.round(r.raw);
  }
  return { harmonized, raw };
}

/** The cell's square as a closed ring [lon, lat], inset by `gap` degrees so columns separate. */
export function cellRing(
  id: number,
  gap = 0.012,
  origin = { west: site.region.west, south: site.region.south },
): [number, number][] {
  const row = Math.floor(id / ID_FACTOR);
  const col = id % ID_FACTOR;
  const w = origin.west + col * GRID_RES + gap / 2;
  const s = origin.south + row * GRID_RES + gap / 2;
  const e = w + GRID_RES - gap;
  const n = s + GRID_RES - gap;
  const r = (x: number) => Math.round(x * 1e6) / 1e6;
  return [
    [r(w), r(s)],
    [r(e), r(s)],
    [r(e), r(n)],
    [r(w), r(n)],
    [r(w), r(s)],
  ];
}

/** Tallest column in metres (the region is ~1,100 km wide, so this reads as a skyline). */
export const MAX_COLUMN_M = 90_000;

/**
 * Column height in metres: proportional to the square root of the count, so a cell with 100×
 * more hotspots is 10× taller. Fire counts are very skewed; with linear heights almost every
 * cell would be invisible. The colour classes carry the exact magnitude.
 */
export function heightScale(maxValue: number): number {
  return maxValue > 0 ? MAX_COLUMN_M / Math.sqrt(maxValue) : 0;
}

/** Largest value across every year and both modes (one scale, so raw and harmonized compare). */
export function maxValue(data: Pick<FireMapData, "harmonized" | "raw">): number {
  let m = 0;
  for (const series of [data.harmonized, data.raw])
    for (const year of series) for (const v of year) if (v > m) m = v;
  return m;
}

/** Colour classes for the map (light ramp: the basemap is light in both colour schemes). */
export function fireMapClasses(max: number): HeatClass[] {
  return heatClasses(max, "light");
}

/** MapLibre `step` expression mapping a numeric expression onto the colour classes. */
export function colorExpression(input: unknown, classes: HeatClass[]): unknown[] {
  const expr: unknown[] = ["step", input, classes[0]?.color ?? HEAT_RAMP.light[0]];
  for (const c of classes.slice(1)) expr.push(c.min, c.color);
  return expr;
}

/** Feature property key for a year and mode, e.g. "h2015" / "r2015". */
export function propKey(mode: "harmonized" | "raw", year: number): string {
  return `${mode === "harmonized" ? "h" : "r"}${year}`;
}

/** Region totals per year (the table alternative to the map). */
export function yearTotals(data: FireMapData): { year: number; harmonized: number; raw: number }[] {
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  return data.years.map((year, i) => ({
    year,
    harmonized: sum(data.harmonized[i]),
    raw: sum(data.raw[i]),
  }));
}
