"use client";

import { useMemo } from "react";
import { EChart, type ChartOption } from "@/components/charts/EChart";
import type { AnalyzeResponse, SourceFlag } from "@/lib/contracts";
import { CHART_THEME, heatClasses } from "@/lib/colors";
import { formatCount, monthLong, monthShort } from "@/lib/format";
import { useColorScheme } from "@/hooks/use-color-scheme";

/** Flags that mean "estimated, lower confidence": drawn with a diagonal hatch. */
const ESTIMATED: SourceFlag[] = ["terra_only_calibrated", "gap_filled", "n20_calibrated"];

export const FLAG_TEXT: Record<SourceFlag, string> = {
  observed: "Observed",
  observed_nrt: "Observed (near-real-time, provisional)",
  calibrated: "Calibrated from MODIS",
  terra_only_calibrated: "Calibrated from MODIS Terra only (lower confidence)",
  n20_calibrated: "Calibrated from VIIRS NOAA-20",
  gap_filled: "Gap-filled (lower confidence)",
};

type Props = {
  calendar: AnalyzeResponse["calendar"];
  unitsShort: string;
  title: string;
};

const ROW_HEIGHT = 17;

export function CalendarHeatmap({ calendar, unitsShort, title }: Props) {
  const scheme = useColorScheme();

  const { option, classes, zeroColor } = useMemo(() => {
    const theme = CHART_THEME[scheme];
    const data: { value: [number, number, number]; flag: SourceFlag | null; itemStyle?: object }[] =
      [];
    let max = 0;
    calendar.years.forEach((year, yi) => {
      calendar.values[yi].forEach((v, m) => {
        if (v === null) return;
        max = Math.max(max, v);
        const flag = calendar.flags[yi][m];
        data.push({
          value: [m, yi, v],
          flag,
          ...(flag && ESTIMATED.includes(flag)
            ? {
                itemStyle: {
                  decal: {
                    symbol: "rect",
                    dashArrayX: [1, 0],
                    dashArrayY: [2, 4],
                    rotation: Math.PI / 4,
                    color: theme.hatch,
                  },
                },
              }
            : {}),
        });
      });
    });
    const classes = heatClasses(max, scheme);

    const option: ChartOption = {
      animation: false,
      aria: { enabled: true, label: { enabled: false } },
      grid: { left: 44, right: 8, top: 26, bottom: 8 },
      xAxis: {
        type: "category",
        position: "top",
        data: Array.from({ length: 12 }, (_, i) => monthShort(i + 1)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.muted, fontSize: 11 },
        splitArea: { show: false },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: calendar.years.map(String),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontSize: 11,
          // Label every other year when there are many rows.
          interval: calendar.years.length > 14 ? 1 : 0,
        },
      },
      visualMap: {
        // Colors only; the legend is HTML below the chart so it can wrap on phones.
        type: "piecewise",
        show: false,
        dimension: 2,
        pieces: [
          { value: 0, label: "0", color: theme.zero },
          ...classes.map((c) => ({ gt: c.min, lte: c.max, label: c.label, color: c.color })),
        ],
      },
      tooltip: {
        trigger: "item",
        backgroundColor: theme.surface,
        borderColor: theme.grid,
        textStyle: { color: theme.text, fontSize: 12 },
        formatter: (p: { data: (typeof data)[number] }) => {
          const [m, yi, v] = p.data.value;
          const flag = p.data.flag;
          // Values lead, labels follow (dataviz skill). All strings are generated here.
          return (
            `<strong style="font-size:14px">${formatCount(v)}</strong> ${unitsShort}<br/>` +
            `${monthLong(m + 1)} ${calendar.years[yi]}` +
            (flag && flag !== "observed"
              ? `<br/><span style="color:${theme.muted}">${FLAG_TEXT[flag]}</span>`
              : "")
          );
        },
      },
      series: [
        {
          type: "heatmap",
          data,
          itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 2 },
          emphasis: { itemStyle: { borderColor: theme.text, borderWidth: 1.5 } },
        },
      ],
    };
    return { option, classes, zeroColor: theme.zero };
  }, [calendar, scheme, unitsShort]);

  const height = calendar.years.length * ROW_HEIGHT + 42;
  return (
    <figure>
      <EChart
        option={option}
        height={height}
        ariaLabel={`${title}: heatmap of monthly ${unitsShort}, ${calendar.years[0]} to ${calendar.years.at(-1)}. A table version follows.`}
      />
      <figcaption>
        <ul
          className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs"
          aria-label={`Color scale, ${unitsShort} per month`}
        >
          {[{ label: "0", color: zeroColor }, ...classes].map((c) => (
            <li key={c.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-3.5 rounded-[2px] ring-1 ring-border"
                style={{ background: c.color }}
              />
              {c.label}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
