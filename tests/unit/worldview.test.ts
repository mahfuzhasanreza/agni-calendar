import { describe, expect, it } from "vitest";
import {
  baseLayers,
  dayOf,
  daysInMonth,
  fireLayers,
  paddedExtent,
  worldviewUrl,
} from "@/lib/worldview";

describe("fireLayers", () => {
  it("uses the reference sensor of the day, with MODIS hidden for comparison in the VIIRS era", () => {
    expect(fireLayers("2008-03-15")).toEqual(["MODIS_Combined_Thermal_Anomalies_All"]);
    expect(fireLayers("2012-01-20")[0]).toBe("VIIRS_SNPP_Thermal_Anomalies_375m_All");
    expect(fireLayers("2024-03-15")).toEqual([
      "VIIRS_SNPP_Thermal_Anomalies_375m_All",
      "MODIS_Combined_Thermal_Anomalies_All(hidden)",
    ]);
    expect(fireLayers("2026-11-01")[0]).toBe("VIIRS_SNPP_Thermal_Anomalies_375m_All");
    expect(fireLayers("2026-11-05")[0]).toBe("VIIRS_NOAA20_Thermal_Anomalies_375m_All");
  });
});

describe("baseLayers", () => {
  it("prefers the gap-free VIIRS image, then MODIS Aqua, then Terra alone", () => {
    expect(baseLayers("2024-03-15")[0]).toBe("VIIRS_NOAA20_CorrectedReflectance_TrueColor");
    expect(baseLayers("2016-03-15")[0]).toBe("VIIRS_SNPP_CorrectedReflectance_TrueColor");
    expect(baseLayers("2008-03-15")).toEqual([
      "MODIS_Aqua_CorrectedReflectance_TrueColor",
      "MODIS_Terra_CorrectedReflectance_TrueColor(hidden)",
    ]);
    expect(baseLayers("2001-03-15")).toEqual(["MODIS_Terra_CorrectedReflectance_TrueColor"]);
  });
});

describe("worldviewUrl", () => {
  it("builds a documented Worldview permalink: projection, extent, layers, UTC day", () => {
    const url = worldviewUrl([91.8, 21.6, 92.7, 23.8], "2024-03-15");
    expect(url).toBe(
      "https://worldview.earthdata.nasa.gov/?p=geographic&v=91.6,21.16,92.9,24.24" +
        "&l=VIIRS_SNPP_Thermal_Anomalies_375m_All,MODIS_Combined_Thermal_Anomalies_All(hidden)," +
        "Coastlines_15m,VIIRS_NOAA20_CorrectedReflectance_TrueColor," +
        "MODIS_Terra_CorrectedReflectance_TrueColor(hidden)" +
        "&t=2024-03-15-T00:00:00Z",
    );
  });

  it("pads small areas by at least 0.2°", () => {
    expect(paddedExtent([90, 22, 90.1, 22.1])).toEqual([89.8, 21.8, 90.3, 22.3]);
  });
});

describe("days", () => {
  it("knows month lengths, including leap years", () => {
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2023-02")).toBe(28);
    expect(daysInMonth("2024-03")).toBe(31);
  });

  it("clamps the day into the month", () => {
    expect(dayOf("2023-02", 31)).toBe("2023-02-28");
    expect(dayOf("2024-03", 0)).toBe("2024-03-01");
    expect(dayOf("2024-03", 15)).toBe("2024-03-15");
  });
});
