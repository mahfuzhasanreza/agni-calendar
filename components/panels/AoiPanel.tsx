"use client";

import { useState } from "react";
import { MapPinned, PenLine, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DrawMode } from "@/components/map/MapView";
import { AoiError, resolveAoi } from "@/lib/aoi";
import type { Aoi } from "@/lib/contracts";
import { PRESETS } from "@/lib/regions";
import { cn } from "@/lib/utils";

type Props = {
  aoi: Aoi;
  onAoi: (aoi: Aoi) => void;
  drawMode: DrawMode;
  onDrawMode: (mode: DrawMode) => void;
};

export function AoiPanel({ aoi, onAoi, drawMode, onDrawMode }: Props) {
  const [tab, setTab] = useState<string>(aoi.type === "preset" ? "preset" : "draw");
  const [lat, setLat] = useState("22.65");
  const [lon, setLon] = useState("92.20");
  const [radius, setRadius] = useState("25");
  const [error, setError] = useState<string | null>(null);

  function applyCircle(e: React.FormEvent) {
    e.preventDefault();
    const candidate: Aoi = {
      type: "circle",
      lat: Number(lat),
      lon: Number(lon),
      radiusKm: Number(radius),
    };
    if ([candidate.lat, candidate.lon, candidate.radiusKm].some((v) => !Number.isFinite(v))) {
      setError("Enter numbers for latitude, longitude and radius.");
      return;
    }
    if (candidate.radiusKm < 1 || candidate.radiusKm > 200) {
      setError("Radius must be between 1 and 200 km.");
      return;
    }
    try {
      resolveAoi(candidate); // same check as the server: inside the loaded region
    } catch (err) {
      setError(err instanceof AoiError ? err.message : "Invalid area.");
      return;
    }
    setError(null);
    onAoi(candidate);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(String(v));
        if (v !== "draw") onDrawMode("none");
      }}
    >
      <TabsList className="w-full">
        <TabsTrigger value="preset">Presets</TabsTrigger>
        <TabsTrigger value="draw">Draw</TabsTrigger>
        <TabsTrigger value="latlon">Lat / Lon</TabsTrigger>
      </TabsList>

      <TabsContent value="preset" className="mt-3">
        <ul className="flex flex-col gap-1.5">
          {PRESETS.map((p) => {
            const active = aoi.type === "preset" && aoi.slug === p.slug;
            return (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => onAoi({ type: "preset", slug: p.slug })}
                  aria-pressed={active}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                    active && "border-foreground bg-accent",
                  )}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Preset outlines are approximate boxes, not official boundaries.
        </p>
      </TabsContent>

      <TabsContent value="draw" className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={drawMode === "rectangle" ? "default" : "outline"}
            onClick={() => onDrawMode("rectangle")}
          >
            <Square /> Rectangle
          </Button>
          <Button
            variant={drawMode === "polygon" ? "default" : "outline"}
            onClick={() => onDrawMode("polygon")}
          >
            <PenLine /> Polygon
          </Button>
          {drawMode !== "none" && (
            <Button variant="ghost" onClick={() => onDrawMode("none")}>
              <X /> Cancel
            </Button>
          )}
        </div>
        <p className="text-muted-foreground" aria-live="polite">
          {drawMode === "rectangle" &&
            "Click once on the map to start, move, and click again to finish."}
          {drawMode === "polygon" &&
            "Click to add corners; click the first corner again to close the shape."}
          {drawMode === "none" && "Pick a tool, then draw inside the dashed region on the map."}
        </p>
      </TabsContent>

      <TabsContent value="latlon" className="mt-3">
        <form onSubmit={applyCircle} className="grid grid-cols-2 gap-3 text-sm" noValidate>
          <div className="flex flex-col gap-1">
            <Label htmlFor="aoi-lat">Latitude (°N)</Label>
            <Input
              id="aoi-lat"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="aoi-lon">Longitude (°E)</Label>
            <Input
              id="aoi-lon"
              inputMode="decimal"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="aoi-radius">Radius (km)</Label>
            <Input
              id="aoi-radius"
              inputMode="decimal"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              <MapPinned /> Show area
            </Button>
          </div>
          {error && (
            <p role="alert" className="col-span-2 text-destructive">
              {error}
            </p>
          )}
        </form>
      </TabsContent>
    </Tabs>
  );
}
