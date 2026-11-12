/** Small geometry helpers for filtering exported detections (no dependencies, unit-tested). */
import type { ResolvedAoi } from "@/lib/aoi";

type Ring = number[][];

/** Ray casting: is [lon, lat] inside the ring? Points on an edge may go either way. */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when the point lies on one of the ring's edges (within ~1 cm). */
export function pointOnRing(lon: number, lat: number, ring: Ring, eps = 1e-7): boolean {
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    const cross = (x2 - x1) * (lat - y1) - (y2 - y1) * (lon - x1);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    if (Math.abs(cross) / len > eps) continue;
    if (
      lon >= Math.min(x1, x2) - eps &&
      lon <= Math.max(x1, x2) + eps &&
      lat >= Math.min(y1, y2) - eps &&
      lat <= Math.max(y1, y2) + eps
    ) {
      return true;
    }
  }
  return false;
}

/**
 * GeoJSON polygon rule: inside the outer ring and outside every hole. Points exactly on the
 * outer boundary count as inside (a drawn box includes its edges, like the bbox rule).
 */
export function pointInPolygon(lon: number, lat: number, rings: Ring[]): boolean {
  if (!pointInRing(lon, lat, rings[0]) && !pointOnRing(lon, lat, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) if (pointInRing(lon, lat, rings[h])) return false;
  return true;
}

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Predicate "is this detection inside the AOI?" for a resolved AOI. */
export function aoiContains(aoi: ResolvedAoi): (lon: number, lat: number) => boolean {
  if (aoi.kind === "circle") {
    return (lon, lat) => distanceKm(aoi.lat, aoi.lon, lat, lon) <= aoi.radiusKm;
  }
  const rings = (JSON.parse(aoi.geojson) as { coordinates: Ring[] }).coordinates;
  const [w, s, e, n] = aoi.bbox;
  return (lon, lat) =>
    lon >= w && lon <= e && lat >= s && lat <= n && pointInPolygon(lon, lat, rings);
}
