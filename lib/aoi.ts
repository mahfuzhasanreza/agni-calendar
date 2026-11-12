/**
 * Area-of-interest resolution: every AOI form (bbox, polygon, lat/lon + radius, preset) becomes
 * one geometry for SQL, plus its bbox. AOIs must lie inside the loaded data region.
 */
import type { Aoi } from "@/lib/contracts";
import { findPreset } from "@/lib/regions";
import { site, type Bbox } from "@/lib/site";

export type BboxTuple = [number, number, number, number];

export type ResolvedAoi =
  | { kind: "geojson"; geojson: string; bbox: BboxTuple; name: string | null }
  | { kind: "circle"; lat: number; lon: number; radiusKm: number; bbox: BboxTuple; name: null };

/** A user-facing problem with the AOI (→ HTTP 400). */
export class AoiError extends Error {}

const KM_PER_DEG_LAT = 111.32;
/** Tolerance for edges drawn exactly on the region border (degrees). */
const EDGE_TOLERANCE = 1e-6;

function bboxPolygon([w, s, e, n]: BboxTuple): { type: "Polygon"; coordinates: number[][][] } {
  return {
    type: "Polygon",
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  };
}

function ringBbox(rings: number[][][]): BboxTuple {
  const outer = rings[0];
  const lons = outer.map((p) => p[0]);
  const lats = outer.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function closeRing(ring: number[][]): number[][] {
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

export function circleBbox(lat: number, lon: number, radiusKm: number): BboxTuple {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLon = radiusKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

/** Throws AoiError unless the bbox lies inside the loaded region. */
export function assertInsideRegion(bbox: BboxTuple, region: Bbox = site.region): void {
  const [w, s, e, n] = bbox;
  const t = EDGE_TOLERANCE;
  if (w < region.west - t || s < region.south - t || e > region.east + t || n > region.north + t) {
    throw new AoiError(
      `The area must lie inside the loaded data region ` +
        `(longitude ${region.west}–${region.east}°E, latitude ${region.south}–${region.north}°N: ` +
        `Bangladesh, Northeast India and western Myanmar).`,
    );
  }
}

export function resolveAoi(aoi: Aoi): ResolvedAoi {
  let resolved: ResolvedAoi;
  switch (aoi.type) {
    case "bbox": {
      const [w, s, e, n] = aoi.bbox;
      if (!(w < e && s < n)) {
        throw new AoiError(
          "bbox must be [west, south, east, north] with west < east, south < north",
        );
      }
      resolved = {
        kind: "geojson",
        geojson: JSON.stringify(bboxPolygon(aoi.bbox)),
        bbox: aoi.bbox,
        name: null,
      };
      break;
    }
    case "polygon": {
      const rings = aoi.coordinates.map(closeRing);
      resolved = {
        kind: "geojson",
        geojson: JSON.stringify({ type: "Polygon", coordinates: rings }),
        bbox: ringBbox(rings),
        name: null,
      };
      break;
    }
    case "circle":
      resolved = {
        kind: "circle",
        lat: aoi.lat,
        lon: aoi.lon,
        radiusKm: aoi.radiusKm,
        bbox: circleBbox(aoi.lat, aoi.lon, aoi.radiusKm),
        name: null,
      };
      break;
    case "preset": {
      const preset = findPreset(aoi.slug);
      if (!preset) throw new AoiError(`unknown preset "${aoi.slug}"`);
      resolved = {
        kind: "geojson",
        geojson: JSON.stringify(bboxPolygon(preset.bbox)),
        bbox: preset.bbox,
        name: preset.name,
      };
      break;
    }
  }
  assertInsideRegion(resolved.bbox);
  return resolved;
}
