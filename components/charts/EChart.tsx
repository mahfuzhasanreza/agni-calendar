"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
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
  MarkAreaComponent,
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
  /**
   * Merge each new option into the chart instead of replacing it, so ECharts animates the
   * change (values tween from old to new). The option must keep a stable shape (same series,
   * same ids/names) across updates. Off: every update redraws from scratch.
   */
  animate?: boolean;
};

/** Animation settings for charts that pass `animate` (none when the user prefers reduced motion). */
export function motion(animate: boolean) {
  return animate
    ? {
        animation: true,
        animationDuration: 600,
        animationDurationUpdate: 900,
        animationEasing: "cubicOut" as const,
        animationEasingUpdate: "cubicInOut" as const,
      }
    : { animation: false };
}

/** Thin React wrapper: one ECharts instance per mount, resized with its container. */
export function EChart({ option, height, ariaLabel, className, animate = false }: Props) {
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
    chart.current?.setOption(option, { notMerge: !animate });
  }, [option, animate]);

  return (
    <div ref={ref} role="img" aria-label={ariaLabel} className={className} style={{ height }} />
  );
}
