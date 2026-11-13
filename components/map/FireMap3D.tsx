"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ring } from "@/lib/aoi-geometry";
import type { Mode } from "@/components/panels/ModeToggle";
import { cellRing, colorExpression, heightScale, propKey, type FireMapData } from "@/lib/fire-map";
import type { HeatClass } from "@/lib/colors";
import { site } from "@/lib/site";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";
const AOI_COLOR = "#2a78d6";

type Props = {
  data: FireMapData;
  classes: HeatClass[];
  max: number;
  mode: Mode;
  year: number;
  ring: Ring | null;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** One extruded 0.1° column per ever-active cell; every year and mode is a feature property. */
function columns(data: FireMapData): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: data.cells.map((id, ci) => {
      const properties: Record<string, number> = {};
      data.years.forEach((y, yi) => {
        properties[propKey("harmonized", y)] = data.harmonized[yi][ci];
        properties[propKey("raw", y)] = data.raw[yi][ci];
      });
      return {
        type: "Feature",
        id,
        properties,
        geometry: { type: "Polygon", coordinates: [cellRing(id)] },
      };
    }),
  };
}

/** Paint/filter for one year and mode. Heights grow with √count (see heightScale). */
function applyYear(map: maplibregl.Map, mode: Mode, year: number, k: number, classes: HeatClass[]) {
  const value: maplibregl.ExpressionSpecification = ["get", propKey(mode, year)];
  map.setFilter("columns", [">", value, 0]);
  map.setPaintProperty("columns", "fill-extrusion-height", ["*", ["sqrt", value], k]);
  map.setPaintProperty(
    "columns",
    "fill-extrusion-color",
    colorExpression(value, classes) as maplibregl.ExpressionSpecification,
  );
}

export default function FireMap3D({ data, classes, max, mode, year, ring }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const geojson = useMemo(() => columns(data), [data]);
  const k = heightScale(max);

  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl(WORKER_URL);
    const { west, south, east, north } = site.region;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      bounds: [
        [west, south],
        [east, north],
      ],
      fitBoundsOptions: { padding: { top: 60, bottom: 10, left: 10, right: 10 } },
      pitch: 55,
      bearing: -12,
      maxPitch: 70,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      map.addSource("columns", { type: "geojson", data: geojson });
      map.addLayer({
        id: "columns",
        type: "fill-extrusion",
        source: "columns",
        paint: { "fill-extrusion-opacity": 0.9, "fill-extrusion-base": 0 },
      });
      map.addSource("aoi", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "aoi-line",
        type: "line",
        source: "aoi",
        paint: { "line-color": AOI_COLOR, "line-width": 2.5 },
      });
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) applyYear(map, mode, year, k, classes);
  }, [ready, mode, year, k, classes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("aoi") as maplibregl.GeoJSONSource | undefined;
    src?.setData(
      ring
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } }
        : EMPTY,
    );
  }, [ready, ring]);

  return (
    <div
      ref={container}
      className="h-[420px] w-full overflow-hidden rounded-lg border sm:h-[520px]"
      role="application"
      aria-label={`3D map of ${mode === "harmonized" ? "harmonized" : "raw"} hotspots per 0.1° cell in ${year}: taller and darker columns mean more fire. The table below lists the yearly totals.`}
    />
  );
}
