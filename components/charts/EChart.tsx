"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Tree-shaken ECharts: only the pieces Agni uses.
echarts.use([
  HeatmapChart,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
  LegendComponent,
  MarkLineComponent,
  AriaComponent,
  CanvasRenderer,
]);

export type ChartOption = echarts.EChartsCoreOption;

type Props = {
  option: ChartOption;
  height: number;
  /** Short description for screen readers; the full data is in the table view. */
  ariaLabel: string;
  className?: string;
};

/** Thin React wrapper: one ECharts instance per mount, resized with its container. */
export function EChart({ option, height, ariaLabel, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: "canvas" });
    chart.current = instance;
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div ref={ref} role="img" aria-label={ariaLabel} className={className} style={{ height }} />
  );
}
