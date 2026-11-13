import { describe, expect, it } from "vitest";
import {
  cellRing,
  colorExpression,
  densify,
  fireMapClasses,
  heightScale,
  MAX_COLUMN_M,
  maxValue,
  propKey,
  yearTotals,
  type FireMapData,
} from "@/lib/fire-map";

describe("cellRing", () => {
  it("places cell id = row * 10000 + col on the 0.1° grid from the region's south-west corner", () => {
    // row 26, col 62 → lat 22.6–22.7, lon 92.2–92.3 (Chittagong Hill Tracts)
    const ring = cellRing(260062, 0);
    expect(ring[0]).toEqual([92.2, 22.6]);
    expect(ring[2]).toEqual([92.3, 22.7]);
    expect(ring[4]).toEqual(ring[0]); // closed
  });

  it("insets the square by the gap so columns stay separate", () => {
    const [[w, s], , [e, n]] = cellRing(0, 0.02);
    expect(w).toBeCloseTo(86.01);
    expect(s).toBeCloseTo(20.01);
    expect(e).toBeCloseTo(86.09);
    expect(n).toBeCloseTo(20.09);
  });
});

describe("densify", () => {
  it("fills every cell × year, rounds, and ignores unknown cells or years", () => {
    const out = densify(
      [
        { cellId: 10, year: 2001, harmonized: 4.6, raw: 1 },
        { cellId: 20, year: 2002, harmonized: 0.4, raw: 2.5 },
        { cellId: 99, year: 2001, harmonized: 7, raw: 7 }, // not ever-active
        { cellId: 10, year: 1999, harmonized: 7, raw: 7 }, // outside the years
      ],
      [10, 20],
      [2001, 2002],
    );
    expect(out.harmonized).toEqual([
      [5, 0],
      [0, 0],
    ]);
    expect(out.raw).toEqual([
      [1, 0],
      [0, 3],
    ]);
  });
});

describe("scales", () => {
  const data: FireMapData = {
    years: [2011, 2012],
    partialYear: null,
    dataThrough: "2012-12",
    modelVersion: "v1",
    cells: [1, 2],
    harmonized: [
      [100, 0],
      [80, 20],
    ],
    raw: [
      [20, 0],
      [400, 100],
    ],
  };

  it("uses one maximum over both modes so raw and harmonized share a scale", () => {
    expect(maxValue(data)).toBe(400);
  });

  it("makes the tallest column MAX_COLUMN_M and height grow with the square root", () => {
    const k = heightScale(400);
    expect(Math.sqrt(400) * k).toBeCloseTo(MAX_COLUMN_M);
    expect((Math.sqrt(100) * k) / (Math.sqrt(1) * k)).toBeCloseTo(10);
    expect(heightScale(0)).toBe(0);
  });

  it("builds a MapLibre step expression over the colour classes", () => {
    const classes = fireMapClasses(400);
    const expr = colorExpression(["get", "h2011"], classes);
    expect(expr[0]).toBe("step");
    expect(expr[2]).toBe(classes[0].color);
    expect(expr.length).toBe(3 + 2 * (classes.length - 1));
  });

  it("sums region totals per year (the table alternative)", () => {
    expect(yearTotals(data)).toEqual([
      { year: 2011, harmonized: 100, raw: 20 },
      { year: 2012, harmonized: 100, raw: 500 },
    ]);
  });

  it("names feature properties per mode and year", () => {
    expect(propKey("harmonized", 2015)).toBe("h2015");
    expect(propKey("raw", 2015)).toBe("r2015");
  });
});
