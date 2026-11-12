import { CHART_THEME, type ColorScheme } from "@/lib/colors";

/** Recessive axes and hairline solid gridlines (dataviz mark specs). */
export function axisStyle(scheme: ColorScheme) {
  const t = CHART_THEME[scheme];
  return {
    axisLine: { lineStyle: { color: t.grid } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" as const } },
    nameTextStyle: { color: t.muted, fontSize: 11 },
  };
}

export function tooltipStyle(scheme: ColorScheme) {
  const t = CHART_THEME[scheme];
  return {
    backgroundColor: t.surface,
    borderColor: t.grid,
    textStyle: { color: t.text, fontSize: 12 },
  };
}

/** Compact axis numbers: full below 10,000, then 10K / 20K. */
export function axisNumber(v: number): string {
  return Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)}K` : v.toLocaleString("en-US");
}

/** A short colored line key for tooltip rows (line keys, not boxes). */
export function lineKey(color: string, dashed = false): string {
  return `<span style="display:inline-block;width:14px;height:0;border-top:2px ${dashed ? "dashed" : "solid"} ${color};vertical-align:middle;margin-right:6px"></span>`;
}
