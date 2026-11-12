"use client";

import { useMemo } from "react";
import { EChart, type ChartOption } from "@/components/charts/EChart";
import { axisNumber, axisStyle, lineKey, tooltipStyle } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/panels/DataTable";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CHART_THEME, SERIES } from "@/lib/colors";
import { formatCount, monthLabel } from "@/lib/format";
import { MODEL_LABELS, type MethodResponse } from "@/lib/method";

/**
 * Held-out validation: observed VIIRS S-NPP vs the prediction from MODIS of a model that never
 * saw that year (region-month totals). Shows the chosen model and the worst one for contrast.
 */
export function ValidationChart({
  cv,
  chosen,
}: {
  cv: MethodResponse["cvPredictions"];
  chosen: string;
}) {
  const scheme = useColorScheme();
  const contrast = "loglog";

  const option = useMemo<ChartOption>(() => {
    const t = CHART_THEME[scheme];
    const c = SERIES[scheme];
    const ax = axisStyle(scheme);
    const names = {
      obs: "Observed VIIRS S-NPP",
      best: `Predicted from MODIS: ${MODEL_LABELS[chosen] ?? chosen}`,
      worst: `Predicted: ${MODEL_LABELS[contrast]}`,
    };
    const line = (color: string, type: "solid" | "dashed" | "dotted") => ({
      type: "line" as const,
      symbol: "circle",
      symbolSize: 8,
      showSymbol: false,
      lineStyle: { width: 2, color, type },
      itemStyle: { color },
    });
    return {
      animation: false,
      aria: { enabled: true, label: { enabled: false } },
      grid: { left: 56, right: 16, top: 64, bottom: 28 },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 18,
        itemHeight: 2,
        textStyle: { color: t.text, fontSize: 12 },
        data: [names.obs, names.best, names.worst],
      },
      xAxis: {
        type: "category",
        data: cv.months,
        boundaryGap: false,
        ...ax,
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "hotspots / month (region)",
        ...ax,
        axisLabel: { ...ax.axisLabel, formatter: axisNumber },
      },
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(scheme),
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0].dataIndex;
          return (
            `<strong>${monthLabel(cv.months[i])}</strong><br/>` +
            `${lineKey(c.s3)}<strong>${formatCount(cv.observed[i])}</strong> observed<br/>` +
            `${lineKey(c.s1, true)}${formatCount(cv.predicted[chosen][i])} ${MODEL_LABELS[chosen] ?? chosen}<br/>` +
            `${lineKey(c.s2, true)}${formatCount(cv.predicted[contrast][i])} ${MODEL_LABELS[contrast]}`
          );
        },
      },
      series: [
        { name: names.obs, ...line(c.s3, "solid"), data: cv.observed },
        { name: names.best, ...line(c.s1, "dashed"), data: cv.predicted[chosen] },
        { name: names.worst, ...line(c.s2, "dotted"), data: cv.predicted[contrast] },
      ],
    };
  }, [cv, chosen, scheme]);

  return (
    <figure>
      <EChart
        option={option}
        height={320}
        ariaLabel="Held-out validation: observed VIIRS monthly totals versus predictions from MODIS by the chosen model and by log-log regression. A table version follows."
      />
      <figcaption className="mt-1 text-xs text-muted-foreground">
        Each month is predicted by a model fitted without that year (leave-one-year-out), from MODIS
        alone. Region totals of the headline metric ({cv.metric}).
      </figcaption>
      <DataTable
        rows={cv.months.map((m, i) => ({ m, i }))}
        caption="Held-out region-month totals"
        columns={[
          { key: "m", label: "Month", value: (r) => r.m },
          {
            key: "o",
            label: "Observed",
            value: (r) => formatCount(cv.observed[r.i]),
            numeric: true,
          },
          ...Object.keys(cv.predicted).map((k) => ({
            key: k,
            label: MODEL_LABELS[k] ?? k,
            value: (r: { i: number }) => formatCount(cv.predicted[k][r.i]),
            numeric: true,
          })),
        ]}
      />
    </figure>
  );
}
