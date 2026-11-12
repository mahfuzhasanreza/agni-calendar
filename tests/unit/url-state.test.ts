import { describe, expect, it } from "vitest";
import {
  analyzeGetUrl,
  DEFAULT_STATE,
  fromSearchParams,
  toSearchParams,
  type ExplorerState,
} from "@/lib/url-state";

const roundTrip = (s: ExplorerState) => fromSearchParams(toSearchParams(s));

describe("shareable URL state", () => {
  it("the default view has an almost empty URL", () => {
    expect(toSearchParams(DEFAULT_STATE).toString()).toBe("preset=chittagong-hill-tracts");
  });

  it("round-trips presets, drawn areas, mode, range and month", () => {
    const preset: ExplorerState = {
      aoi: { type: "preset", slug: "sundarbans" },
      mode: "raw",
      start: "2005-01",
      end: "2015-12",
      month: "2010-03",
    };
    expect(roundTrip(preset)).toEqual(preset);
    const circle: ExplorerState = {
      ...DEFAULT_STATE,
      aoi: { type: "circle", lat: 22.65, lon: 92.2, radiusKm: 20 },
    };
    expect(roundTrip(circle)).toEqual(circle);
  });

  it("ignores anything invalid or outside the region", () => {
    const p = new URLSearchParams({
      aoi: JSON.stringify({ type: "bbox", bbox: [-64.5, -31.5, -64, -31] }),
      mode: "magic",
      start: "2020-13",
      month: "x",
    });
    expect(fromSearchParams(p)).toEqual(DEFAULT_STATE);
    expect(fromSearchParams(new URLSearchParams("aoi=%7Bbroken"))).toEqual(DEFAULT_STATE);
    expect(fromSearchParams(new URLSearchParams("preset=atlantis"))).toEqual(DEFAULT_STATE);
  });

  it("presets use the cacheable GET, other areas do not", () => {
    expect(analyzeGetUrl({ ...DEFAULT_STATE, month: "2024-03" })).toBe(
      "/api/analyze?preset=chittagong-hill-tracts&mode=harmonized&start=2000-11&selectedMonth=2024-03",
    );
    expect(
      analyzeGetUrl({ ...DEFAULT_STATE, aoi: { type: "circle", lat: 22, lon: 90, radiusKm: 5 } }),
    ).toBeNull();
  });
});
