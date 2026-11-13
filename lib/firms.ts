/**
 * Official NASA FIRMS acknowledgement, algorithm references, data caveats and links.
 * Sources (read 2026-11-13): https://www.earthdata.nasa.gov/data/tools/firms (+ /faq),
 * the NASA Earthdata alert on Suomi NPP cessation, and https://firms.modaps.eosdis.nasa.gov/alerts/.
 */
import type { BboxTuple } from "@/lib/aoi";

export const FIRMS_URLS = {
  home: "https://www.earthdata.nasa.gov/data/tools/firms",
  faq: "https://www.earthdata.nasa.gov/data/tools/firms/faq",
  fireMap: "https://firms.modaps.eosdis.nasa.gov/map/",
  alerts: "https://firms.modaps.eosdis.nasa.gov/alerts/",
  lanceDisclaimer: "https://www.earthdata.nasa.gov/data/projects/lance/disclaimer",
  snppCessation:
    "https://www.earthdata.nasa.gov/data/alerts-outages/reminder-new-suomi-npp-observations-cease-november-2-2026",
} as const;

/** Acknowledgement text requested by FIRMS (Earthdata FIRMS page). */
export const FIRMS_ACKNOWLEDGEMENT =
  "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource " +
  "Management System (FIRMS) (https://earthdata.nasa.gov/firms), operated by NASA's ESDIS project " +
  "as part of LANCE.";

export type Reference = { text: string; doi: string };

/** Peer-reviewed descriptions of the active-fire detection algorithms behind the FIRMS products. */
export const ALGORITHM_REFERENCES: readonly Reference[] = [
  {
    text: "Giglio, L., Schroeder, W., Justice, C.O. (2016). The collection 6 MODIS active fire detection algorithm and fire products. Remote Sensing of Environment 178, 31–41.",
    doi: "10.1016/j.rse.2016.02.054",
  },
  {
    text: "Schroeder, W., Oliva, P., Giglio, L., Csiszar, I.A. (2014). The New VIIRS 375 m active fire detection data product: algorithm description and initial assessment. Remote Sensing of Environment 143, 85–96.",
    doi: "10.1016/j.rse.2013.12.008",
  },
];

/** Data caveats stated by FIRMS, in plain language. Shown on the Method page and in exports. */
export const FIRMS_CAVEATS: readonly string[] = [
  'FIRMS data are provided "as is"; users bear all responsibility and liability for their use (LANCE disclaimer).',
  "Each hotspot is the centre of a ~1 km (MODIS) or 375 m (VIIRS) pixel flagged as containing one or more fires or other thermal anomalies, not the exact fire location.",
  "Fires can be missed: under cloud, thick smoke or tree canopy, when too small or cool, when they start and end between satellite overpasses, or during instrument outages.",
  "Near-real-time positions are usually within 100 m but can be off by several km after spacecraft manoeuvres.",
  "Dates and times are UTC (acquisition time of the satellite overpass).",
];

/** NASA alert: Suomi NPP stopped delivering data at 15:40 UTC on 2 Nov 2026 (NOAA NESDIS). */
export const SNPP_END_NOTICE =
  "NASA: Suomi NPP stopped delivering data at 15:40 UTC on 2 November 2026; users are directed to NOAA-20 and NOAA-21.";

/** Comment lines appended to the detections CSV (pandas: read_csv(..., comment="#")). */
export function csvNoteLines(): string[] {
  return [
    `# ${FIRMS_ACKNOWLEDGEMENT}`,
    ...FIRMS_CAVEATS.map((c) => `# Caveat: ${c}`),
    `# More: ${FIRMS_URLS.faq}`,
  ];
}

/** "west,south,east,north" rounded to 2 decimals: the box format FIRMS alerts and API accept. */
export function bboxText([w, s, e, n]: BboxTuple): string {
  const r = (x: number) => String(Math.round(x * 100) / 100);
  return [r(w), r(s), r(e), r(n)].join(",");
}
