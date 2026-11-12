"use client";

import { useMemo } from "react";
import { EChart, type ChartOption } from "@/components/charts/EChart";
import { axisNumber, axisStyle, lineKey, tooltipStyle } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/panels/DataTable";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CHART_THEME, SERIES } from "@/lib/colors";
import type { AnalyzeResponse } from "@/lib/contracts";
import { formatCount } from "@/lib/format";

type Props = {
  annual: AnalyzeResponse["annual"];
  unitsShort: string;
  title: string;
};

/** Annual totals (bars) with the Sen's-slope trend over complete years. */
export function AnnualChart({ annual, unitsShort, title }: Props) {
  const scheme = useColorScheme();
  const trend = annual.trend;

  const option = useMemo<ChartOption>(() => {
    const t = CHART_THEME[scheme];
    const c = SERIES[scheme];
    const ax = axisStyle(scheme);
    const years = annual.years;
    const trendValue = (y: number) =>
      trend && y >= trend.fromYear && y <= trend.toYear
        ? trend.intercept + trend.slopePerYear * y
        : null;
    return {
      animation: false,
      aria: { enabled: true, label: { enabled: false } },
      grid: { left: 52, right: 16, top: 56, bottom: 28 },
      legend: {
        top: 0,
        left: 0,
        textStyle: { color: t.text, fontSize: 12 },
        data: [
          { name: "Annual total", icon: "roundRect" },
          ...(trend
            ? [{ name: "Trend (Sen's slope)", icon: "path://M0,0 L18,0 L18,2 L0,2 Z" }]
            : []),
        ],
      },
      xAxis: {
        type: "category",
        data: years.map((y) => String(y.year)),
        ...ax,
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: unitsShort.replace("hotspots", "hotspots / year"),
        ...ax,
        axisLabel: { ...ax.axisLabel, formatter: axisNumber },
      },
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(scheme),
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(127,127,127,0.08)" } },
        formatter: (params: { dataIndex: number }[]) => {
          const y = years[params[0].dataIndex];
          const band =
            y.low !== null && y.high !== null && y.low !== y.high
              ? ` <span style="color:${t.muted}">(P10–P90 ${formatCount(y.low)}–${formatCount(y.high)})</span>`
              : "";
          const tv = trendValue(y.year);
          return (
            `<strong>${y.year}</strong>${y.complete ? "" : ` <span style="color:${t.muted}">(partial year)</span>`}<br/>` +
            `<strong>${formatCount(y.total)}</strong> ${unitsShort}${band}` +
            (tv !== null ? `<br/>${lineKey(c.s2)}trend ${formatCount(tv)}` : "")
          );
        },
      },
      series: [
        {
          name: "Annual total",
          type: "bar",
          barMaxWidth: 24,
          data: years.map((y) => ({
            value: y.total,
            itemStyle: {
              color: c.s1,
              opacity: y.complete ? 1 : 0.35,
              borderRadius: [4, 4, 0, 0],
            },
          })),
        },
        ...(trend
          ? [
              {
                name: "Trend (Sen's slope)",
                type: "line",
                data: years.map((y) => trendValue(y.year)),
                symbol: "none",
                lineStyle: { width: 2, color: c.s2 },
                itemStyle: { color: c.s2 },
                connectNulls: false,
              },
            ]
          : []),
      ],
    };
  }, [annual, scheme, trend, unitsShort]);

  return (
    <figure>
      {trend ? (
        <p className="mb-3 text-sm">
          Trend {trend.fromYear}–{trend.toYear}:{" "}
          <strong className="tabular-nums">
            {trend.slopePerYear > 0 ? "+" : ""}
            {formatCount(trend.slopePerYear)} hotspots per year
          </strong>{" "}
          (Mann–Kendall p = {trend.mannKendallP.toFixed(4)},{" "}
          {trend.significant ? "statistically significant" : "not statistically significant"} at 5
          %).
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          Not enough complete years in the range for a trend.
        </p>
      )}
      <EChart
        option={option}
        height={280}
        ariaLabel={`${title}: annual ${unitsShort} with trend line. A table version follows.`}
      />
      <figcaption className="mt-1 text-xs text-muted-foreground">
        Pale bars are partial years. The trend uses complete years from 2003, the first full year
        with both MODIS satellites.
      </figcaption>
      <DataTable
        rows={annual.years}
        caption={`${title}: annual ${unitsShort}`}
        columns={[
          { key: "y", label: "Year", value: (y) => `${y.year}${y.complete ? "" : " (partial)"}` },
          { key: "t", label: "Total", value: (y) => formatCount(y.total), numeric: true },
          {
            key: "b",
            label: "P10–P90",
            value: (y) =>
              y.low === null || y.high === null || y.low === y.high
                ? "—"
                : `${formatCount(y.low)}–${formatCount(y.high)}`,
            numeric: true,
          },
        ]}
      />
    </figure>
  );
}
