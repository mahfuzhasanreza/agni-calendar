"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { EChart, motion, type ChartOption } from "@/components/charts/EChart";
import { axisNumber, axisStyle, lineKey, tooltipStyle } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/panels/DataTable";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { annualBySensor, periodChange, type AnnualSensors } from "@/lib/chart-data";
import { CHART_THEME, SERIES } from "@/lib/colors";
import type { SeriesPoint } from "@/lib/contracts";
import { formatCount } from "@/lib/format";

const fmtFactor = (x: number | null) => (x === null ? "—" : `×${x.toFixed(2)}`);

/** "raw": the main line shows the naive stitched record; "harmonized": the final record. */
type Stage = "raw" | "harmonized";
/** How long the naive record stays on screen before it morphs into the harmonized one (ms). */
const HOLD_MS = 1200;

/**
 * The harmonization moment: when the chart first scrolls into view, the main line starts as the
 * naive raw record (with the 2012 jump) and morphs into the harmonized record while the
 * uncertainty band fades in. "Replay" runs it again. Reduced motion: always the final state.
 */
function useHarmonizeStory(animate: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<Stage>(animate ? "raw" : "harmonized");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = () => {
    if (timer.current) clearTimeout(timer.current);
    setStage("raw");
    timer.current = setTimeout(() => setStage("harmonized"), HOLD_MS);
  };

  useEffect(() => {
    const el = ref.current;
    if (!animate || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          timer.current = setTimeout(() => setStage("harmonized"), HOLD_MS);
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [animate]);

  return { ref, stage: animate ? stage : ("harmonized" as Stage), play };
}

/**
 * The demo's key chart: annual MODIS (raw) vs VIIRS (raw) vs the harmonized record with its
 * P10–P90 band. Complete years only.
 */
export function RawVsHarmonizedChart({ series, title }: { series: SeriesPoint[]; title: string }) {
  const scheme = useColorScheme();
  const animate = !useReducedMotion();
  const { ref, stage, play } = useHarmonizeStory(animate);
  const rows = useMemo(() => annualBySensor(series).filter((r) => r.complete), [series]);

  const change = useMemo(() => {
    const before: [number, number] = [2009, 2011];
    const after: [number, number] = [2012, 2014];
    return {
      naive: periodChange(rows, (r) => r.naive, before, after),
      modis: periodChange(rows, (r) => r.modis, before, after),
      harmonized: periodChange(rows, (r) => r.harmonized, before, after),
    };
  }, [rows]);

  const option = useMemo<ChartOption>(() => {
    const t = CHART_THEME[scheme];
    const c = SERIES[scheme];
    const years = rows.map((r) => String(r.year));
    const ax = axisStyle(scheme);
    const line = (color: string, type: "solid" | "dashed" | "dotted") => ({
      type: "line" as const,
      symbol: "circle",
      symbolSize: 8,
      showSymbol: false,
      lineStyle: { width: 2, color, type, cap: "round" as const, join: "round" as const },
      itemStyle: { color },
      emphasis: { focus: "none" as const },
    });
    const harmonized = stage === "harmonized";
    const mainName = harmonized ? "Harmonized (VIIRS-equivalent)" : "Raw record (sensors joined)";
    return {
      ...motion(animate),
      aria: { enabled: true, label: { enabled: false } },
      grid: { left: 52, right: 96, top: 56, bottom: 28 },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 18,
        itemHeight: 2,
        textStyle: { color: t.text, fontSize: 12 },
        data: [mainName, "MODIS raw", "VIIRS S-NPP raw"],
      },
      xAxis: {
        type: "category",
        data: years,
        boundaryGap: false,
        ...ax,
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "hotspots / year",
        ...ax,
        axisLabel: { ...ax.axisLabel, formatter: axisNumber },
      },
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(scheme),
        axisPointer: { type: "line", lineStyle: { color: t.muted, width: 1 } },
        formatter: (params: { dataIndex: number }[]) => {
          const r: AnnualSensors = rows[params[0].dataIndex];
          const band =
            r.low !== r.high
              ? ` <span style="color:${t.muted}">(${formatCount(r.low)}–${formatCount(r.high)})</span>`
              : "";
          return (
            `<strong>${r.year}</strong><br/>` +
            `${lineKey(c.s1)}<strong>${formatCount(r.harmonized)}</strong> harmonized${band}<br/>` +
            `${lineKey(c.s2, true)}${formatCount(r.modis)} MODIS raw<br/>` +
            (r.viirs !== null
              ? `${lineKey(c.s3, true)}${formatCount(r.viirs)} VIIRS S-NPP raw`
              : "")
          );
        },
      },
      series: [
        // P10–P90 band: invisible base + stacked difference with a 12 % wash.
        // Before the morph the band collapses onto the raw line (zero width, invisible).
        {
          id: "band-base",
          name: "band-base",
          type: "line",
          stack: "band",
          data: rows.map((r) => (harmonized ? r.low : r.naive)),
          lineStyle: { opacity: 0 },
          symbol: "none",
          silent: true,
          tooltip: { show: false },
        },
        {
          id: "band",
          name: "P10–P90 range",
          type: "line",
          stack: "band",
          data: rows.map((r) => (harmonized ? r.high - r.low : 0)),
          lineStyle: { opacity: 0 },
          areaStyle: { color: c.s1, opacity: harmonized ? 0.12 : 0 },
          symbol: "none",
          silent: true,
          tooltip: { show: false },
        },
        {
          id: "modis",
          name: "MODIS raw",
          ...line(c.s2, "dashed"),
          data: rows.map((r) => r.modis),
          endLabel: { show: true, formatter: "MODIS raw", color: t.text, fontSize: 11 },
        },
        {
          id: "viirs",
          name: "VIIRS S-NPP raw",
          ...line(c.s3, "dotted"),
          data: rows.map((r) => r.viirs),
          endLabel: { show: false },
        },
        {
          id: "main",
          name: mainName,
          ...line(c.s1, "solid"),
          data: rows.map((r) => (harmonized ? r.harmonized : r.naive)),
          endLabel: {
            show: true,
            formatter: harmonized ? "Harmonized" : "Raw record",
            color: t.text,
            fontSize: 11,
          },
          markArea: {
            silent: true,
            itemStyle: { color: t.muted, opacity: 0.14 },
            label: { color: t.muted, fontSize: 11, position: "insideTop" },
            data: years.includes("2002")
              ? [[{ name: "Terra only", xAxis: years[0] }, { xAxis: "2002" }]]
              : [],
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: t.muted, width: 1, type: "solid" },
            label: {
              formatter: "VIIRS era →",
              color: t.muted,
              fontSize: 11,
              position: "insideEndTop",
            },
            data: years.includes("2012") ? [{ xAxis: "2012" }] : [],
          },
        },
      ],
    };
  }, [rows, scheme, stage, animate]);

  if (rows.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Choose a longer date range to compare sensors.
      </p>
    );
  }

  return (
    <figure ref={ref}>
      {change.naive !== null && change.harmonized !== null && (
        <p className="mb-3 text-sm">
          Change from 2009–11 to 2012–14: raw record{" "}
          <strong className="tabular-nums">{fmtFactor(change.naive)}</strong> (sensor switch) ·
          harmonized <strong className="tabular-nums">{fmtFactor(change.harmonized)}</strong> ·
          MODIS alone, no switch <strong className="tabular-nums">{fmtFactor(change.modis)}</strong>
        </p>
      )}
      {animate && (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span aria-live="polite">
            {stage === "raw"
              ? "Raw record: MODIS until 2011, VIIRS from 2012. Note the jump…"
              : "Harmonized: the 2012 jump is gone."}
          </span>
          <button
            type="button"
            onClick={play}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 hover:bg-accent"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Replay
          </button>
        </div>
      )}
      <EChart
        option={option}
        height={320}
        animate={animate}
        ariaLabel={`${title}: annual hotspots, harmonized versus raw MODIS and raw VIIRS, ${rows[0].year} to ${rows.at(-1)!.year}. A table version follows.`}
      />
      <figcaption className="mt-1 text-xs text-muted-foreground">
        Complete years only. Blue wash: P10–P90 range of the harmonized estimate. Grey: years seen
        by MODIS Terra alone (morning overpass), scaled up to Terra + Aqua, so the least certain.
        From 2012 the harmonized line is the observed VIIRS S-NPP record (the VIIRS line lies under
        it).
      </figcaption>
      <DataTable
        rows={rows}
        caption={`${title}: annual hotspots by sensor`}
        columns={[
          { key: "y", label: "Year", value: (r) => String(r.year) },
          { key: "h", label: "Harmonized", value: (r) => formatCount(r.harmonized), numeric: true },
          {
            key: "b",
            label: "P10–P90",
            value: (r) =>
              r.low === r.high ? "observed" : `${formatCount(r.low)}–${formatCount(r.high)}`,
            numeric: true,
          },
          { key: "m", label: "MODIS raw", value: (r) => formatCount(r.modis), numeric: true },
          {
            key: "v",
            label: "VIIRS raw",
            value: (r) => (r.viirs === null ? "—" : formatCount(r.viirs)),
            numeric: true,
          },
        ]}
      />
    </figure>
  );
}
