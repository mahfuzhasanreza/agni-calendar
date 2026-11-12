"use client";

import { useMemo } from "react";
import { EChart, type ChartOption } from "@/components/charts/EChart";
import { axisNumber, axisStyle, lineKey, tooltipStyle } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/panels/DataTable";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { annualBySensor, periodChange, type AnnualSensors } from "@/lib/chart-data";
import { CHART_THEME, SERIES } from "@/lib/colors";
import type { SeriesPoint } from "@/lib/contracts";
import { formatCount } from "@/lib/format";

const fmtFactor = (x: number | null) => (x === null ? "—" : `×${x.toFixed(2)}`);

/**
 * The demo's key chart: annual MODIS (raw) vs VIIRS (raw) vs the harmonized record with its
 * P10–P90 band. Complete years only.
 */
export function RawVsHarmonizedChart({ series, title }: { series: SeriesPoint[]; title: string }) {
  const scheme = useColorScheme();
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
    return {
      animation: false,
      aria: { enabled: true, label: { enabled: false } },
      grid: { left: 52, right: 96, top: 56, bottom: 28 },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 18,
        itemHeight: 2,
        textStyle: { color: t.text, fontSize: 12 },
        data: ["Harmonized (VIIRS-equivalent)", "MODIS raw", "VIIRS S-NPP raw"],
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
        {
          name: "band-base",
          type: "line",
          stack: "band",
          data: rows.map((r) => r.low),
          lineStyle: { opacity: 0 },
          symbol: "none",
          silent: true,
          tooltip: { show: false },
        },
        {
          name: "P10–P90 range",
          type: "line",
          stack: "band",
          data: rows.map((r) => r.high - r.low),
          lineStyle: { opacity: 0 },
          areaStyle: { color: c.s1, opacity: 0.12 },
          symbol: "none",
          silent: true,
          tooltip: { show: false },
        },
        {
          name: "MODIS raw",
          ...line(c.s2, "dashed"),
          data: rows.map((r) => r.modis),
          endLabel: { show: true, formatter: "MODIS raw", color: t.text, fontSize: 11 },
        },
        {
          name: "VIIRS S-NPP raw",
          ...line(c.s3, "dotted"),
          data: rows.map((r) => r.viirs),
          endLabel: { show: false },
        },
        {
          name: "Harmonized (VIIRS-equivalent)",
          ...line(c.s1, "solid"),
          data: rows.map((r) => r.harmonized),
          endLabel: { show: true, formatter: "Harmonized", color: t.text, fontSize: 11 },
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
  }, [rows, scheme]);

  if (rows.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Choose a longer date range to compare sensors.
      </p>
    );
  }

  return (
    <figure>
      {change.naive !== null && change.harmonized !== null && (
        <p className="mb-3 text-sm">
          Change from 2009–11 to 2012–14: raw record{" "}
          <strong className="tabular-nums">{fmtFactor(change.naive)}</strong> (sensor switch) ·
          harmonized <strong className="tabular-nums">{fmtFactor(change.harmonized)}</strong> ·
          MODIS alone, no switch <strong className="tabular-nums">{fmtFactor(change.modis)}</strong>
        </p>
      )}
      <EChart
        option={option}
        height={320}
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
