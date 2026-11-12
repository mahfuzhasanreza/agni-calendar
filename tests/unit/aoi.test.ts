import { describe, expect, it } from "vitest";
import { AoiError, circleBbox, resolveAoi } from "@/lib/aoi";
import { AnalyzeRequest } from "@/lib/contracts";
import { PRESETS } from "@/lib/regions";

describe("resolveAoi", () => {
  it("bbox becomes a closed polygon", () => {
    const r = resolveAoi({ type: "bbox", bbox: [92, 22, 92.5, 22.5] });
    expect(r.kind).toBe("geojson");
    if (r.kind !== "geojson") return;
    const ring = JSON.parse(r.geojson).coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(r.bbox).toEqual([92, 22, 92.5, 22.5]);
  });

  it("rejects an inverted bbox", () => {
    expect(() => resolveAoi({ type: "bbox", bbox: [92.5, 22, 92, 22.5] })).toThrow(AoiError);
  });

  it("closes open polygon rings and computes the bbox", () => {
    const r = resolveAoi({
      type: "polygon",
      coordinates: [
        [
          [92, 22],
          [92.4, 22.1],
          [92.2, 22.6],
          [91.9, 22.3],
        ],
      ],
    });
    if (r.kind !== "geojson") throw new Error("expected geojson");
    const ring = JSON.parse(r.geojson).coordinates[0];
    expect(ring[ring.length - 1]).toEqual([92, 22]);
    expect(r.bbox).toEqual([91.9, 22, 92.4, 22.6]);
  });

  it("circle bbox grows in longitude away from the equator", () => {
    const [w, s, e, n] = circleBbox(23, 90, 50);
    expect(n - s).toBeCloseTo((2 * 50) / 111.32, 6);
    expect(e - w).toBeGreaterThan(n - s);
  });

  it("every preset resolves inside the region", () => {
    for (const p of PRESETS) {
      expect(resolveAoi({ type: "preset", slug: p.slug }).name).toBe(p.name);
    }
  });

  it("unknown presets and areas outside the region give a clear error", () => {
    expect(() => resolveAoi({ type: "preset", slug: "atlantis" })).toThrow(/unknown preset/);
    expect(() => resolveAoi({ type: "bbox", bbox: [-64.5, -31.5, -64, -31] })).toThrow(
      /inside the loaded data region/,
    );
    // Circle reaching over the western edge (86°E).
    expect(() => resolveAoi({ type: "circle", lat: 23, lon: 86.1, radiusKm: 50 })).toThrow(
      AoiError,
    );
  });
});

describe("AnalyzeRequest schema", () => {
  it("applies defaults", () => {
    const r = AnalyzeRequest.parse({ aoi: { type: "preset", slug: "sundarbans" } });
    expect(r.mode).toBe("harmonized");
    expect(r.start).toBe("2000-11");
    expect(r.baseline).toEqual({ from: 2003, to: 2022 });
  });

  it.each([
    [{ aoi: { type: "bbox", bbox: [92, 22, 93] } }],
    [{ aoi: { type: "circle", lat: 23, lon: 90, radiusKm: 0 } }],
    [{ aoi: { type: "preset", slug: "x" }, start: "2020-13" }],
    [{ aoi: { type: "preset", slug: "x" }, mode: "magic" }],
    [{ aoi: { type: "preset", slug: "x" }, baseline: { from: 2020, to: 2010 } }],
    [
      {
        aoi: {
          type: "polygon",
          coordinates: [
            [
              [92, 22],
              [93, 22],
              [92, 22],
            ],
          ],
        },
      },
    ],
  ])("rejects %j", (input) => {
    expect(AnalyzeRequest.safeParse(input).success).toBe(false);
  });
});
