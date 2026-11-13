"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Loader2, Pause, Play } from "lucide-react";
import { DataTable } from "@/components/panels/DataTable";
import type { Mode } from "@/components/panels/ModeToggle";
import type { Ring } from "@/lib/aoi-geometry";
import { fireMapClasses, maxValue, yearTotals, type FireMapData } from "@/lib/fire-map";
import { formatCount } from "@/lib/format";
import { SNPP_FIRST_FULL_MONTH } from "@/lib/sensors";

// WebGL map: browser only, and only loaded when the visitor opens it (saves phones the cost).
const FireMap3D = dynamic(() => import("@/components/map/FireMap3D"), {
  ssr: false,
  loading: () => <MapPlaceholder text="Loading the 3D map…" />,
});

/** Time per year while playing (ms). Steps are discrete, so reduced motion is respected. */
const STEP_MS = 900;
const VIIRS_YEAR = Number(SNPP_FIRST_FULL_MONTH.slice(0, 4));

function MapPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-lg border text-sm text-muted-foreground sm:h-[520px]">
      {text}
    </div>
  );
}

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: FireMapData }
  | { status: "error"; error: string };

/**
 * "25 years of fire in 3D": whole-region columns per 0.1° cell, one year at a time, following
 * the explorer's Raw / Harmonized switch. Raw shows the 2012 sensor jump; harmonized removes it.
 */
export function FireMapPanel({ mode, ring }: { mode: Mode; ring: Ring | null }) {
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [yearIndex, setYearIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function open() {
    setLoad({ status: "loading" });
    try {
      const res = await fetch("/api/fire-map");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const data = body as FireMapData;
      // Start on the last complete year.
      setYearIndex(data.years.length - (data.partialYear ? 2 : 1));
      setLoad({ status: "ready", data });
    } catch (e) {
      setLoad({ status: "error", error: (e as Error).message || "Could not load the map data." });
    }
  }

  const data = load.status === "ready" ? load.data : null;
  const max = useMemo(() => (data ? maxValue(data) : 0), [data]);
  const classes = useMemo(() => fireMapClasses(max), [max]);
  const totals = useMemo(() => (data ? yearTotals(data) : []), [data]);

  useEffect(() => {
    if (!playing || !data) return;
    timer.current = setInterval(() => {
      setYearIndex((i) => {
        if (i >= data.years.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, STEP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, data]);

  function togglePlay() {
    if (!data) return;
    if (!playing && yearIndex >= data.years.length - 1) setYearIndex(0);
    setPlaying((p) => !p);
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          Every 0.1° grid cell of the region as a column: taller and darker means more hotspots that
          year. Play through 2001–today in <strong>Raw</strong> to see the 2012 sensor jump light up
          the whole map, then in <strong>Harmonized</strong> to see it disappear.
        </p>
        <button
          type="button"
          onClick={open}
          disabled={load.status === "loading"}
          className="inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 font-medium hover:bg-accent disabled:opacity-60"
        >
          {load.status === "loading" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Box className="size-4" aria-hidden />
          )}
          Open the 3D fire map
        </button>
        {load.status === "error" && (
          <p role="alert" className="text-destructive">
            {load.error}
          </p>
        )}
      </div>
    );
  }

  const year = data.years[yearIndex];
  const total = totals[yearIndex];
  const era =
    mode === "raw"
      ? year < VIIRS_YEAR
        ? "MODIS era (1 km pixels)"
        : "VIIRS era (375 m pixels)"
      : "VIIRS S-NPP-equivalent";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="relative">
        <FireMap3D data={data} classes={classes} max={max} mode={mode} year={year} ring={ring} />
        <div className="pointer-events-none absolute top-2 left-2 rounded-lg bg-background/85 px-3 py-2 shadow-sm">
          <p className="text-3xl leading-none font-semibold tabular-nums" aria-live="polite">
            {year}
            {year === data.partialYear && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">(partial)</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "raw" ? "Raw" : "Harmonized"} · {era}
          </p>
          <p className="text-xs tabular-nums">
            <strong>{formatCount(mode === "raw" ? total.raw : total.harmonized)}</strong> hotspots
            in the region
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium hover:bg-accent"
        >
          {playing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          {playing ? "Pause" : "Play 2001 → today"}
        </button>
        <label className="flex min-w-48 flex-1 items-center gap-2">
          <span className="font-medium">Year</span>
          <input
            type="range"
            min={0}
            max={data.years.length - 1}
            step={1}
            value={yearIndex}
            aria-valuetext={String(year)}
            onChange={(e) => {
              setPlaying(false);
              setYearIndex(Number(e.target.value));
            }}
            className="flex-1 accent-[#2a78d6]"
          />
        </label>
      </div>

      <ul
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
        aria-label="Column colour: hotspots per cell per year"
      >
        {classes.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-3.5 rounded-[2px] ring-1 ring-border"
              style={{ background: c.color }}
            />
            {c.label}
          </li>
        ))}
        <li className="text-muted-foreground">hotspots per 0.1° cell per year</li>
      </ul>
      <p className="text-xs text-muted-foreground">
        Column height grows with the square root of the count (100× more hotspots = 10× taller), so
        small fires stay visible; colour gives the class. Same scale for Raw and Harmonized. Single
        cells are much less certain than area totals: read the map for patterns. Blue outline: your
        selected area. Drag with the right mouse button (or two fingers) to tilt and rotate; Ctrl/⌘
        + scroll to zoom.
      </p>
      <DataTable
        rows={totals}
        caption="Region-wide hotspots per year (all ever-active 0.1° cells)"
        columns={[
          {
            key: "y",
            label: "Year",
            value: (r) => `${r.year}${r.year === data.partialYear ? " (partial)" : ""}`,
          },
          {
            key: "h",
            label: "Harmonized",
            value: (r) => formatCount(r.harmonized),
            numeric: true,
          },
          { key: "r", label: "Raw", value: (r) => formatCount(r.raw), numeric: true },
        ]}
      />
    </div>
  );
}
