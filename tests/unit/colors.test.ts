import { describe, expect, it } from "vitest";
import { HEAT_RAMP, heatBreaks, heatClasses } from "@/lib/colors";
import { aoiRing, circleRing, ringBounds } from "@/lib/aoi-geometry";
import { formatCount, monthLabel } from "@/lib/format";

describe("heat scale", () => {
  it("log-spaced 1-2-5 breaks for skewed fire counts", () => {
    expect(heatBreaks(4877)).toEqual([2, 20, 50, 200, 1000]);
    expect(heatBreaks(0)).toEqual([]);
  });

  it("breaks are strictly increasing and below the maximum", () => {
    for (const max of [0.4, 3, 17, 250, 12_000, 1e6]) {
      const b = heatBreaks(max);
      b.forEach((x, i) => {
        expect(x).toBeLessThan(max);
        if (i > 0) expect(x).toBeGreaterThan(b[i - 1]);
      });
    }
  });

  it("the top class always takes the strongest color of the ramp", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const max of [0.5, 5, 4877]) {
        const classes = heatClasses(max, scheme);
        expect(classes.at(-1)!.color).toBe(HEAT_RAMP[scheme].at(-1));
        expect(classes[0].min).toBe(0);
      }
    }
  });

  it("classes are contiguous", () => {
    const c = heatClasses(4877, "light");
    for (let i = 1; i < c.length; i++) expect(c[i].min).toBe(c[i - 1].max);
    expect(c.at(-1)!.label).toBe("> 1,000");
  });
});

describe("AOI geometry for the map", () => {
  it("circle ring is closed and spans the radius", () => {
    const ring = circleRing(23, 90, 50);
    expect(ring[0][0]).toBeCloseTo(ring.at(-1)![0], 9);
    const [, s, , n] = ringBounds(ring);
    expect(n - s).toBeCloseTo((2 * 50) / 111.32, 3);
  });

  it("presets and bboxes become rectangles", () => {
    expect(aoiRing({ type: "bbox", bbox: [90, 22, 91, 23] })).toHaveLength(5);
    expect(aoiRing({ type: "preset", slug: "sundarbans" })).toHaveLength(5);
    expect(aoiRing({ type: "preset", slug: "nope" })).toBeNull();
  });
});

describe("formatting", () => {
  it("counts", () => {
    expect(formatCount(4877.4)).toBe("4,877");
    expect(formatCount(3.25)).toBe("3.3");
    expect(formatCount(0)).toBe("0");
  });
  it("month labels", () => {
    expect(monthLabel("2014-03")).toBe("March 2014");
  });
});
