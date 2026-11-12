import { describe, expect, it } from "vitest";
import { inBbox, site } from "@/lib/site";

describe("site config", () => {
  it("has a well-formed region bbox", () => {
    const { west, south, east, north } = site.region;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
  });

  it("credits NASA FIRMS and both sensor families", () => {
    expect(site.dataCredit).toContain("NASA FIRMS");
    expect(site.dataCredit).toContain("MODIS");
    expect(site.dataCredit).toContain("VIIRS");
  });
});

describe("inBbox", () => {
  it("accepts points inside the region (Chittagong Hill Tracts, Sundarbans)", () => {
    expect(inBbox(22.65, 92.2)).toBe(true);
    expect(inBbox(21.95, 89.18)).toBe(true);
  });

  it("accepts points on the edges", () => {
    expect(inBbox(20, 86)).toBe(true);
    expect(inBbox(28, 97)).toBe(true);
  });

  it("rejects points outside the region", () => {
    expect(inBbox(23.8, 85.9)).toBe(false); // west of the box
    expect(inBbox(28.1, 90)).toBe(false); // north of the box
    expect(inBbox(-31.4, -64.2)).toBe(false); // Córdoba, Argentina
  });
});
