/** Client-side AOI geometry for drawing on the map (the server does the real spatial work). */
import type { Aoi } from "@/lib/contracts";
import { findPreset } from "@/lib/regions";

export type Ring = [number, number][];
export type BboxTuple = [number, number, number, number];

const KM_PER_DEG_LAT = 111.32;

function rect([w, s, e, n]: BboxTuple): Ring {
  return [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ];
}

/** 64-gon approximating a circle of radiusKm (equirectangular; fine at this scale). */
export function circleRing(lat: number, lon: number, radiusKm: number, steps = 64): Ring {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLon = radiusKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  const ring: Ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

/** Outer ring of the AOI, or null for an unknown preset. */
export function aoiRing(aoi: Aoi): Ring | null {
  switch (aoi.type) {
    case "bbox":
      return rect(aoi.bbox);
    case "polygon":
      return aoi.coordinates[0] as Ring;
    case "circle":
      return circleRing(aoi.lat, aoi.lon, aoi.radiusKm);
    case "preset": {
      const p = findPreset(aoi.slug);
      return p ? rect(p.bbox) : null;
    }
  }
}

export function ringBounds(ring: Ring): BboxTuple {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/** Human description of an AOI for headings. */
export function describeAoi(aoi: Aoi): string {
  switch (aoi.type) {
    case "preset":
      return findPreset(aoi.slug)?.name ?? aoi.slug;
    case "circle":
      return `${aoi.radiusKm} km around ${aoi.lat.toFixed(3)}°N, ${aoi.lon.toFixed(3)}°E`;
    case "bbox":
      return "Drawn rectangle";
    case "polygon":
      return "Drawn area";
  }
}
