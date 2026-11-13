"use client";

import { useMemo } from "react";
import { EChart, motion, type ChartOption } from "@/components/charts/EChart";
import { axisNumber, axisStyle, lineKey, tooltipStyle } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/panels/DataTable";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CHART_THEME, SERIES } from "@/lib/colors";
import type { AnalyzeResponse } from "@/lib/contracts";
import { formatCount, monthLong, monthShort } from "@/lib/format";

type Props = {
  season: AnalyzeResponse["season"];
  baseline: AnalyzeResponse["baseline"];
  unitsShort: string;
  title: string;
};

/** Fire season profile: baseline median with its P10–P90 range, and the selected year. */
export function SeasonChart({ season, baseline, unitsShort, title }: Props) {
  const scheme = useColorScheme();
  const animate = !useReducedMotion();
  const year = season.selectedYear.year;
  const medianName = `Median ${baseline.from}–${baseline.to}`;

  const option = useMemo<ChartOption>(() => {
    const t = CHART_THEME[scheme];
    const c = SERIES[scheme];
    const ax = axisStyle(scheme);
    const m = season.months;
    return {
      ...motion(animate),
      aria: { enabled: true, label: { enabled: false } },
      grid: { left: 52, right: 16, top: 56, bottom: 28 },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 18,
        itemHeight: 2,
        textStyle: { color: t.text, fontSize: 12 },
        data: [medianName, String(year)],
      },
      xAxis: {
        type: "category",
        data: m.map((s) => monthShort(s.month)),
        boundaryGap: false,
        ...ax,
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: unitsShort.replace("hotspots", "hotspots / month"),
        ...ax,
        axisLabel: { ...ax.axisLabel, formatter: axisNumber },
      },
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(scheme),
        axisPointer: { type: "line", lineStyle: { color: t.muted, width: 1 } },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0].dataIndex;
          const s = m[i];
          const v = season.selectedYear.values[i];
          return (
            `<strong>${monthLong(s.month)}</strong><br/>` +
            (v !== null
              ? `${lineKey(c.s2)}<strong>${formatCount(v)}</strong> in ${year}<br/>`
              : "") +
            `${lineKey(c.s1)}${formatCount(s.median)} median ` +
            `<span style="color:${t.muted}">(P10–P90 ${formatCount(s.p10)}–${formatCount(s.p90)})</span>`
          );
        },
      },
      series: [
        {
          id: "p10",
          name: "p10",
          type: "line",
          stack: "range",
          data: m.map((s) => s.p10),
          lineStyle: { opacity: 0 },
          symbol: "none",
          silent: true,
        },
        {
          id: "range",
          name: "P10–P90",
          type: "line",
          stack: "range",
          data: m.map((s) => s.p90 - s.p10),
          lineStyle: { opacity: 0 },
          areaStyle: { color: c.s1, opacity: 0.12 },
          symbol: "none",
          silent: true,
        },
        {
          id: "median",
          name: medianName,
          type: "line",
          data: m.map((s) => s.median),
          symbol: "circle",
          symbolSize: 8,
          showSymbol: false,
          lineStyle: { width: 2, color: c.s1 },
          itemStyle: { color: c.s1 },
        },
        {
          id: "selected",
          name: String(year),
          type: "line",
          data: season.selectedYear.values,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 2, color: c.s2 },
          itemStyle: { color: c.s2, borderColor: t.surface, borderWidth: 2 },
          connectNulls: false,
        },
      ],
    };
  }, [season, scheme, medianName, year, unitsShort, animate]);

  return (
    <figure>
      <EChart
        option={option}
        height={280}
        animate={animate}
        ariaLabel={`${title}: monthly fire season profile, ${medianName} with P10 to P90 range, and ${year}. A table version follows.`}
      />
      <figcaption className="mt-1 text-xs text-muted-foreground">
        Shaded: P10–P90 of the baseline years, i.e. 8 in 10 years fall inside it.
      </figcaption>
      <DataTable
        rows={season.months}
        caption={`${title}: monthly ${unitsShort}, baseline ${baseline.from}–${baseline.to}`}
        columns={[
          { key: "m", label: "Month", value: (s) => monthLong(s.month) },
          { key: "md", label: "Median", value: (s) => formatCount(s.median), numeric: true },
          { key: "p10", label: "P10", value: (s) => formatCount(s.p10), numeric: true },
          { key: "p90", label: "P90", value: (s) => formatCount(s.p90), numeric: true },
          {
            key: "y",
            label: String(year),
            value: (s) => {
              const v = season.selectedYear.values[s.month - 1];
              return v === null ? "—" : formatCount(v);
            },
            numeric: true,
          },
        ]}
      />
    </figure>
  );
}
