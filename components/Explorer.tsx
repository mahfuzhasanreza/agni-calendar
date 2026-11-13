"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Link2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnnualChart } from "@/components/charts/AnnualChart";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { RawVsHarmonizedChart } from "@/components/charts/RawVsHarmonizedChart";
import { SeasonChart } from "@/components/charts/SeasonChart";
import { AnomalyCard } from "@/components/panels/AnomalyCard";
import { ExportButtons } from "@/components/panels/ExportButtons";
import { FireMapPanel } from "@/components/panels/FireMapPanel";
import { FirmsLinks } from "@/components/panels/FirmsLinks";
import { WorldviewLink } from "@/components/panels/WorldviewLink";
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
import {
  analyzeGetUrl,
  fromSearchParams,
  toSearchParams,
  type ExplorerState,
} from "@/lib/url-state";

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
  // Rendered in the browser only (see ExplorerClient), so a shared link's URL is the
  // initial state.
  const [initial] = useState(() => fromSearchParams(new URLSearchParams(window.location.search)));
  const [aoi, setAoi] = useState<Aoi>(initial.aoi);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState<string>(initial.end);
  const [selectedMonth, setSelectedMonth] = useState<string>(initial.month);
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [state, setState] = useState<State>({ status: "loading", data: null });
  const [copied, setCopied] = useState(false);

  const query = useMemo<ExplorerState>(
    () => ({
      aoi,
      mode,
      start: MONTH_RE.test(start) ? start : RECORD_START,
      end: MONTH_RE.test(end) ? end : "",
      month: MONTH_RE.test(selectedMonth) ? selectedMonth : "",
    }),
    [aoi, mode, start, end, selectedMonth],
  );

  // Keep the address bar in sync so the current view can be shared.
  useEffect(() => {
    const qs = toSearchParams(query).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // Fetch whenever the query changes (debounced; stale requests are aborted).
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setState((s) => ({ status: "loading", data: s.data }));
      try {
        // Presets use the CDN-cacheable GET; drawn areas, circles and boxes use POST.
        const getUrl = analyzeGetUrl(query);
        const res = getUrl
          ? await fetch(getUrl, { signal: ctrl.signal })
          : await fetch("/api/analyze", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                aoi: query.aoi,
                mode: query.mode,
                start: query.start,
                ...(query.end ? { end: query.end } : {}),
                ...(query.month ? { selectedMonth: query.month } : {}),
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
  }, [query]);

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

      {data ? (
        <div
          className={`flex flex-col gap-6 ${state.status === "loading" ? "opacity-60 transition-opacity" : ""}`}
        >
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{title}</span>
            <span>
              · {formatArea(data.aoi.areaKm2)} · {data.aoi.cells} grid cells (0.1°) · data through{" "}
              {data.dataThroughDate}
            </span>
            {data.modelVersion && <Badge variant="outline">model {data.modelVersion}</Badge>}
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
            >
              <Link2 className="size-3.5" aria-hidden />
              {copied ? "Link copied" : "Copy link to this view"}
            </button>
            {state.status === "loading" && (
              <Loader2 className="size-4 animate-spin" aria-label="Loading" />
            )}
          </p>

          <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
            <Panel
              title="This month vs history"
              description="Selected month against the same month in past years."
            >
              <AnomalyCard
                anomaly={data.anomaly}
                baseline={data.baseline}
                unitsShort={unitsShort}
                mode={mode}
                dataThrough={data.dataThrough}
                latestCompleteMonth={data.latestCompleteMonth}
                onSelectMonth={setSelectedMonth}
              />
              <WorldviewLink aoi={aoi} month={data.anomaly.month} />
            </Panel>
            <Panel
              title="One record from two sensor families"
              description="Raw MODIS and raw VIIRS counts cannot be compared; the harmonized record can."
            >
              <RawVsHarmonizedChart series={data.series} title={title} />
              <SourceFootnote />
            </Panel>
          </div>

          <Panel
            title={`Burning calendar`}
            description={`Monthly ${unitsShort}, one row per year.`}
          >
            <CalendarHeatmap calendar={data.calendar} unitsShort={unitsShort} title={title} />
            <p className="mt-1 text-xs text-muted-foreground">
              Hatched cells are estimates with lower confidence. Hover a cell for its value.
            </p>
            <CalendarTable calendar={data.calendar} caption={`${title}: monthly ${unitsShort}`} />
            <SourceFootnote />
          </Panel>

          <Panel
            title="25 years of fire in 3D"
            description="The whole region, one year at a time. Switch Raw / Harmonized above."
          >
            <FireMapPanel mode={mode} ring={ring} />
            <SourceFootnote />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Fire season profile"
              description={`Which months burn: typical year vs ${data.season.selectedYear.year}.`}
            >
              <SeasonChart
                season={data.season}
                baseline={data.baseline}
                unitsShort={unitsShort}
                title={title}
              />
              <SourceFootnote />
            </Panel>
            <Panel
              title="Annual totals and trend"
              description="Which years burned most, and the long-term direction."
            >
              <AnnualChart annual={data.annual} unitsShort={unitsShort} title={title} />
              <SourceFootnote />
            </Panel>
          </div>

          <Panel title="Download the evidence" description={`CSV files for ${title}.`}>
            <ExportButtons aoi={aoi} start={data.range.start} end={data.range.end} />
          </Panel>

          <Panel
            title="Live fires and alerts"
            description="Hand-over to NASA FIRMS for near-real-time monitoring."
          >
            <FirmsLinks aoi={aoi} />
          </Panel>
        </div>
      ) : state.status === "loading" ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Loading 25 years of fire data…
        </div>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
