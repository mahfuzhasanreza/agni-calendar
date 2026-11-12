/** Static facts about the app, shared by pages, charts and API responses. */
export const site = {
  name: "Agni",
  nameBn: "অগ্নি",
  tagline: "25 years of fire history, one consistent calendar.",
  description:
    "A sensor-independent burning calendar for Bangladesh, Northeast India and western Myanmar, " +
    "built by harmonizing NASA MODIS and VIIRS active-fire hotspots (2000 to today).",
  dataCredit:
    "Data: NASA FIRMS. MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m Collection 2 (S-NPP, NOAA-20).",
  repoUrl: "https://github.com/mahfuzhasanreza/agni-calendar",
  /** Bounding box of the loaded data, in degrees (WGS84). */
  region: { west: 86, south: 20, east: 97, north: 28 },
} as const;

export type Bbox = { west: number; south: number; east: number; north: number };

/** True when the point lies inside the bbox (edges inclusive). */
export function inBbox(lat: number, lon: number, bbox: Bbox = site.region): boolean {
  return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}
