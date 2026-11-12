"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { AoiPanel } from "@/components/panels/AoiPanel";
import { CalendarTable } from "@/components/panels/CalendarTable";
import { ModeToggle, type Mode } from "@/components/panels/ModeToggle";
import { SourceFootnote } from "@/components/panels/SourceFootnote";
import type { DrawMode } from "@/components/map/MapView";
import { aoiRing, describeAoi, type Ring } from "@/lib/aoi-geometry";
import type { Aoi, AnalyzeResponse, ApiError } from "@/lib/contracts";
import { formatArea } from "@/lib/format";
import { MONTH_RE } from "@/lib/months";
import { RECORD_START } from "@/lib/sensors";

// MapLibre needs the browser (WebGL), so the map is never server-rendered.
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center rounded-lg border text-sm text-muted-foreground lg:h-full lg:min-h-[420px]">
      Loading map…
    </div>
  ),
});

type State =
  | { status: "loading"; data: AnalyzeResponse | null }
  | { status: "ready"; data: AnalyzeResponse }
  | { status: "error"; data: AnalyzeResponse | null; error: string };

export function Explorer() {
  const [aoi, setAoi] = useState<Aoi>({ type: "preset", slug: "chittagong-hill-tracts" });
  const [mode, setMode] = useState<Mode>("harmonized");
  const [start, setStart] = useState(RECORD_START);
  const [end, setEnd] = useState<string>("");
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [state, setState] = useState<State>({ status: "loading", data: null });

  // Fetch whenever the query changes (debounced; stale requests are aborted).
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setState((s) => ({ status: "loading", data: s.data }));
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            aoi,
            mode,
            start: MONTH_RE.test(start) ? start : RECORD_START,
            ...(MONTH_RE.test(end) ? { end } : {}),
          }),
          signal: ctrl.signal,
        });
        const body = (await res.json()) as AnalyzeResponse | ApiError;
        if (!res.ok || "error" in body) {
          const err = body as ApiError;
          setState((s) => ({
            status: "error",
            data: s.data,
            error: err.error ?? `HTTP ${res.status}`,
          }));
          return;
        }
        setState({ status: "ready", data: body as AnalyzeResponse });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState((s) => ({ status: "error", data: s.data, error: "Could not reach the server." }));
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [aoi, mode, start, end]);

  const onDrawn = useCallback((ring: Ring) => {
    setAoi({ type: "polygon", coordinates: [ring] });
    setDrawMode("none");
  }, []);

  const ring = useMemo(() => aoiRing(aoi), [aoi]);
  const data = state.data;
  const placeholderModel = data?.modelVersion === "raw-v0";
  const title = describeAoi(aoi);
  const unitsShort = mode === "harmonized" ? "hotspots (VIIRS-equivalent)" : "hotspots (raw)";

  return (
    <div className="flex flex-col gap-6">
      <section
        className="grid gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]"
        aria-label="Choose an area"
      >
        <div className="flex flex-col gap-5">
          <AoiPanel aoi={aoi} onAoi={setAoi} drawMode={drawMode} onDrawMode={setDrawMode} />
          <fieldset className="grid grid-cols-2 gap-3 text-sm">
            <legend className="mb-1.5 text-sm font-medium">Date range</legend>
            <div className="flex flex-col gap-1">
              <Label htmlFor="range-start">From</Label>
              <Input
                id="range-start"
                type="month"
                min={RECORD_START}
                max={data?.dataThrough}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="range-end">To</Label>
              <Input
                id="range-end"
                type="month"
                min={RECORD_START}
                max={data?.dataThrough}
                value={end || data?.dataThrough || ""}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </fieldset>
          <ModeToggle mode={mode} onMode={setMode} />
        </div>
        <MapView ring={ring} drawMode={drawMode} onDrawn={onDrawn} />
      </section>

      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>That area could not be analysed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {placeholderModel && mode === "harmonized" && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Calibration in progress</AlertTitle>
          <AlertDescription>
            The harmonized view currently shows the raw sensor record (model “raw-v0”). The MODIS →
            VIIRS calibration is being built during the hackathon and will replace it.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">Burning calendar: {title}</CardTitle>
            {state.status === "loading" && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
            )}
          </div>
          <CardDescription>
            Monthly {unitsShort}, one row per year.
            {data && (
              <>
                {" "}
                Area {formatArea(data.aoi.areaKm2)} · {data.aoi.cells} grid cells (0.1°) · data
                through {data.dataThroughDate}
                {data.modelVersion && (
                  <>
                    {" "}
                    · <Badge variant="outline">model {data.modelVersion}</Badge>
                  </>
                )}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className={state.status === "loading" ? "opacity-60 transition-opacity" : ""}>
              <CalendarHeatmap calendar={data.calendar} unitsShort={unitsShort} title={title} />
              <p className="mt-1 text-xs text-muted-foreground">
                Hatched cells are estimates with lower confidence. Hover a cell for its value.
              </p>
              <CalendarTable calendar={data.calendar} caption={`${title}: monthly ${unitsShort}`} />
              <SourceFootnote />
            </div>
          ) : state.status === "loading" ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading 25 years of fire data…
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
