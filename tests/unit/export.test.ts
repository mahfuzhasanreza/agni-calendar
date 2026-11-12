import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveAoi } from "@/lib/aoi";
import type { SeriesPoint } from "@/lib/contracts";
import { ExportRequest, firstDay, lastDay, seriesCsv, slug } from "@/lib/export";
import { aoiContains, distanceKm, pointInPolygon, pointInRing } from "@/lib/geo";

const square = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];

describe("geometry", () => {
  it("point in ring / polygon with a hole", () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(11, 5, square)).toBe(false);
    const hole = [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ];
    expect(pointInPolygon(5, 5, [square, hole])).toBe(false);
    expect(pointInPolygon(2, 2, [square, hole])).toBe(true);
  });

  it("points on the outer boundary count as inside (every edge)", () => {
    for (const [x, y] of [
      [10, 5],
      [0, 5],
      [5, 0],
      [5, 10],
      [10, 10],
    ]) {
      expect(pointInPolygon(x, y, [square])).toBe(true);
    }
    expect(pointInPolygon(10.000001, 5, [square])).toBe(false);
  });

  it("haversine distance (1° of latitude ≈ 111.2 km)", () => {
    expect(distanceKm(22, 90, 23, 90)).toBeCloseTo(111.2, 0);
  });

  it("AOI predicates for presets and circles", () => {
    const cht = aoiContains(resolveAoi({ type: "preset", slug: "chittagong-hill-tracts" }));
    expect(cht(92.2, 22.6)).toBe(true);
    expect(cht(90.4, 23.8)).toBe(false); // Dhaka
    const circle = aoiContains(resolveAoi({ type: "circle", lat: 22.6, lon: 92.2, radiusKm: 10 }));
    expect(circle(92.2, 22.65)).toBe(true); // ~5.6 km away
    expect(circle(92.2, 22.8)).toBe(false); // ~22 km away
  });
});

describe("export helpers", () => {
  it("month boundaries", () => {
    expect(firstDay("2024-02")).toBe("2024-02-01");
    expect(lastDay("2024-02")).toBe("2024-02-29");
    expect(lastDay("2025-12")).toBe("2025-12-31");
  });

  it("file-name slugs", () => {
    expect(slug("Chittagong Hill Tracts (Bangladesh)")).toBe("chittagong-hill-tracts-bangladesh");
    expect(slug("!!!")).toBe("area");
  });

  it("request schema defaults", () => {
    const r = ExportRequest.parse({ aoi: { type: "preset", slug: "sundarbans" } });
    expect(r.start).toBe("2000-11");
    expect(r.end).toBeUndefined();
  });

  it("series CSV has one row per month with every column", () => {
    const p: SeriesPoint = {
      month: "2010-03",
      value: 10,
      low: 8,
      high: 12,
      flag: "calibrated",
      raw: { modisT: 1, modisA: 2, viirsSnpp: 0, viirsN20: 0, naive: 3 },
      harmonized: 10.123,
      harmonizedLow: 8,
      harmonizedHigh: 12,
    };
    const lines = seriesCsv([p], "v1").trim().split("\n");
    expect(lines[0].split(",")).toHaveLength(11);
    expect(lines[1]).toBe("2010-03,10.12,8,12,calibrated,1,2,0,0,3,v1");
  });
});

describe("tile export (real gzip files)", () => {
  const dir = mkdtempSync(join(tmpdir(), "agni-tiles-"));
  const columns =
    "date,time_utc,lat,lon,sensor,satellite,confidence,conf_class,qualified,frp,brightness,bright_t31,daynight,type,source";
  const row = (date: string, lat: number, lon: number) =>
    `${date},0730,${lat},${lon},VIIRS_SNPP,SNPP,n,nominal,1,5.0,330.0,295.0,D,0,archive`;
  let original: string | undefined;

  beforeAll(() => {
    const tile = [
      columns,
      row("2014-03-01", 22.6, 92.2),
      row("2014-03-02", 22.6, 92.9),
      row("2015-01-01", 22.7, 92.3),
    ];
    writeFileSync(join(dir, "t22_092.csv.gz"), gzipSync(tile.join("\n") + "\n"));
    writeFileSync(
      join(dir, "t25_090.csv.gz"),
      gzipSync([columns, row("2014-03-01", 25.5, 90.5)].join("\n")),
    );
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        dataset_version: "test",
        columns: columns.split(","),
        tiles: [
          {
            key: "t22_092",
            file: "t22_092.csv.gz",
            bbox: [92, 22, 93, 23],
            rows: 3,
            date_min: "2014-03-01",
            date_max: "2015-01-01",
          },
          {
            key: "t25_090",
            file: "t25_090.csv.gz",
            bbox: [90, 25, 91, 26],
            rows: 1,
            date_min: "2014-03-01",
            date_max: "2014-03-01",
          },
        ],
      }),
    );
    original = process.env.TILES_BASE_URL;
    process.env.TILES_BASE_URL = `file://${dir}`;
  });
  afterAll(() => {
    process.env.TILES_BASE_URL = original;
  });

  it("streams only detections inside the area and date range", async () => {
    const { exportDetections } = await import("@/lib/tiles");
    const aoi = resolveAoi({ type: "bbox", bbox: [92.0, 22.0, 92.5, 23.0] });
    const out: string[] = [];
    for await (const line of exportDetections({
      bbox: aoi.bbox,
      contains: aoiContains(aoi),
      startDate: "2014-01-01",
      endDate: "2014-12-31",
      maxRows: 100,
    })) {
      out.push(line);
    }
    expect(out[0]).toBe(columns);
    expect(out.slice(1)).toEqual([row("2014-03-01", 22.6, 92.2)]); // lon 92.9 outside, 2015 outside
  });

  it("stops with a note at the row limit", async () => {
    const { exportDetections } = await import("@/lib/tiles");
    const aoi = resolveAoi({ type: "bbox", bbox: [92.0, 22.0, 93.0, 23.0] });
    const out: string[] = [];
    for await (const line of exportDetections({
      bbox: aoi.bbox,
      contains: aoiContains(aoi),
      startDate: "2014-01-01",
      endDate: "2015-12-31",
      maxRows: 1,
    })) {
      out.push(line);
    }
    expect(out).toHaveLength(3);
    expect(out[2]).toMatch(/^# truncated at 1 rows/);
  });
});
