/**
 * Deep links into NASA Worldview (Earthdata's satellite imagery viewer) for an area and day.
 * URL parameters as documented in https://github.com/nasa-gibs/worldview (doc/url_parameters.md):
 * p = projection, v = extent (west,south,east,north in degrees), t = YYYY-MM-DD-Thh:mm:ssZ (UTC),
 * l = comma-separated layer ids, overlays first, base layer last; "(hidden)" = listed but off.
 * Layer ids are Worldview config names (config/default/common/config/wv.json/layers).
 */
import type { BboxTuple } from "@/lib/aoi";

export const WORLDVIEW_BASE = "https://worldview.earthdata.nasa.gov/";

const LAYERS = {
  modisFires: "MODIS_Combined_Thermal_Anomalies_All",
  snppFires: "VIIRS_SNPP_Thermal_Anomalies_375m_All",
  n20Fires: "VIIRS_NOAA20_Thermal_Anomalies_375m_All",
  coastlines: "Coastlines_15m",
  terraTrueColor: "MODIS_Terra_CorrectedReflectance_TrueColor",
  aquaTrueColor: "MODIS_Aqua_CorrectedReflectance_TrueColor",
  snppTrueColor: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
  n20TrueColor: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
} as const;

/** Worldview's MODIS fire layer is Terra + Aqua combined: no fire layer before Aqua (checked). */
export const WORLDVIEW_FIRES_FROM = "2002-07-04";

/** S-NPP 375 m record in FIRMS: 20 Jan 2012 → 1 Nov 2026 (NASA: data ended 2 Nov 2026). */
const SNPP_FIRST_DAY = "2012-01-20";
const SNPP_LAST_DAY = "2026-11-01";

/** The fire layer of the sensor Agni uses as reference on that day, plus MODIS for comparison. */
export function fireLayers(date: string): string[] {
  if (date < SNPP_FIRST_DAY) return [LAYERS.modisFires];
  const viirs = date <= SNPP_LAST_DAY ? LAYERS.snppFires : LAYERS.n20Fires;
  return [viirs, `${LAYERS.modisFires}(hidden)`];
}

/** Viewport around the area with a 20 % margin (at least 0.2°), so the context is visible. */
export function paddedExtent([w, s, e, n]: BboxTuple): BboxTuple {
  const padX = Math.max((e - w) * 0.2, 0.2);
  const padY = Math.max((n - s) * 0.2, 0.2);
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return [r(w - padX), r(s - padY), r(e + padX), r(n + padY)];
}

/**
 * Background image for the day. MODIS swaths leave opaque black gaps between orbits at these
 * latitudes, so the gap-free VIIRS image is used where it is safely available (checked in
 * Worldview); before that MODIS Aqua (record from 4 Jul 2002), with Terra listed but hidden so
 * users can swap it in when Aqua has a gap; before Aqua, Terra alone.
 */
export function baseLayers(date: string): string[] {
  if (date >= "2018-01-01") return [LAYERS.n20TrueColor, `${LAYERS.terraTrueColor}(hidden)`];
  if (date >= "2016-01-01") return [LAYERS.snppTrueColor, `${LAYERS.terraTrueColor}(hidden)`];
  if (date >= "2002-07-04") return [LAYERS.aquaTrueColor, `${LAYERS.terraTrueColor}(hidden)`];
  return [LAYERS.terraTrueColor];
}

/** Worldview link for an area (bbox) on one UTC day (YYYY-MM-DD). */
export function worldviewUrl(bbox: BboxTuple, date: string): string {
  const layers = [...fireLayers(date), LAYERS.coastlines, ...baseLayers(date)];
  // Commas and parentheses are kept literal, as in Worldview's own permalinks.
  return (
    `${WORLDVIEW_BASE}?p=geographic&v=${paddedExtent(bbox).join(",")}` +
    `&l=${layers.join(",")}&t=${date}-T00:00:00Z`
  );
}

/** Days in a YYYY-MM month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** A day of the month clamped to the month's length, as YYYY-MM-DD. */
export function dayOf(month: string, day: number): string {
  const d = Math.min(Math.max(1, Math.round(day)), daysInMonth(month));
  return `${month}-${String(d).padStart(2, "0")}`;
}
