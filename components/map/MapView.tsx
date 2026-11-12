"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRectangleMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { ringBounds, type Ring } from "@/lib/aoi-geometry";
import { site } from "@/lib/site";

/** Free vector basemap, no API key (OpenFreeMap, © OpenMapTiles © OpenStreetMap). */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const AOI_COLOR = "#2a78d6";
/** Served from public/ (copied on install by scripts/copy-maplibre-worker.mjs). */
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";

export type DrawMode = "none" | "rectangle" | "polygon";

type Props = {
  ring: Ring | null;
  drawMode: DrawMode;
  onDrawn: (ring: Ring) => void;
};

const { west, south, east, north } = site.region;
const REGION_RING: Ring = [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];

function polygonFeature(ring: Ring): GeoJSON.Feature<GeoJSON.Polygon> {
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function MapView({ ring, drawMode, onDrawn }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const onDrawnRef = useRef(onDrawn);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onDrawnRef.current = onDrawn;
  }, [onDrawn]);

  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl(WORKER_URL);
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      bounds: [
        [west, south],
        [east, north],
      ],
      fitBoundsOptions: { padding: 20 },
      maxBounds: [
        [west - 8, south - 6],
        [east + 8, north + 6],
      ],
      attributionControl: { compact: true },
      // Page scroll stays page scroll; zoom with Ctrl/⌘ + scroll or two fingers.
      cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("region", { type: "geojson", data: polygonFeature(REGION_RING) });
      map.addLayer({
        id: "region-line",
        type: "line",
        source: "region",
        paint: { "line-color": "#525252", "line-width": 1.5, "line-dasharray": [3, 2] },
      });
      map.addSource("aoi", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "aoi-fill",
        type: "fill",
        source: "aoi",
        paint: { "fill-color": AOI_COLOR, "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "aoi-line",
        type: "line",
        source: "aoi",
        paint: { "line-color": AOI_COLOR, "line-width": 2 },
      });

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [new TerraDrawRectangleMode(), new TerraDrawPolygonMode()],
      });
      draw.start();
      draw.on("finish", (id) => {
        const feature = draw.getSnapshotFeature(id);
        if (feature?.geometry.type === "Polygon") {
          onDrawnRef.current(feature.geometry.coordinates[0] as Ring);
        }
        // The drawn shape is shown by the "aoi" layer; terra-draw's copy is not needed.
        draw.clear();
      });
      drawRef.current = draw;
      setReady(true);
    });

    mapRef.current = map;
    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Show the current AOI and zoom to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("aoi") as maplibregl.GeoJSONSource | undefined;
    src?.setData(ring ? polygonFeature(ring) : EMPTY);
    if (ring) {
      const [w, s, e, n] = ringBounds(ring);
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 40, duration: 600, maxZoom: 9 },
      );
    }
  }, [ring, ready]);

  // Switch drawing tools.
  useEffect(() => {
    if (!ready || !drawRef.current) return;
    drawRef.current.setMode(drawMode === "none" ? "static" : drawMode);
  }, [drawMode, ready]);

  return (
    <div
      ref={container}
      className="h-[360px] w-full overflow-hidden rounded-lg border lg:h-full lg:min-h-[420px]"
      role="application"
      aria-label="Map of the study region. Use the Draw tab to outline an area, or choose a preset or enter coordinates."
    />
  );
}
