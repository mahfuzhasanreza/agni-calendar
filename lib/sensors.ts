/**
 * Sensor record facts, verified against the FIRMS download (CLAUDE.md §4.4).
 * Used to build the "raw" (naive) series: whichever sensor a naive user would pick per month.
 */
export const RECORD_START = "2000-11"; // MODIS Terra
export const AQUA_START = "2002-07";
/** First month with S-NPP data for (almost) the whole month (record starts 2012-01-20). */
export const SNPP_FIRST_FULL_MONTH = "2012-02";
/** S-NPP data ends 2026-11-01; NOAA-20 continues the VIIRS record after that. */
export const SNPP_LAST_MONTH = "2026-11";

export const UNITS = {
  harmonized: "hotspots per month (VIIRS S-NPP-equivalent)",
  raw: "hotspots per month (raw counts of the sensor available at the time)",
} as const;

export const DATA_SOURCE =
  "NASA FIRMS: MODIS Collection 6.1 (Terra, Aqua), VIIRS 375 m Collection 2 (S-NPP, NOAA-20).";
