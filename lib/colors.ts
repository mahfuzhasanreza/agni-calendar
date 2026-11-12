/**
 * Accessible color scales (CLAUDE.md §6: viridis/cividis only, never red-green).
 *
 * The heatmap uses 6 classes sampled from matplotlib's viridis, trimmed per mode so the faint
 * end still contrasts with the surface. Low values sit near the surface lightness in each
 * mode (light mode: low = light; dark mode: low = dark). Validated with the dataviz skill's
 * validate_palette.js --ordinal: lightness monotone, adjacent ΔL ≥ 0.06, end contrast ≥ 2:1
 * (light 2.25:1 on #ffffff; dark 2.71:1 on the #171717 card). "Single hue" is knowingly not met:
 * viridis is a perceptually uniform, colorblind-safe multi-hue ramp mandated by the project.
 */

export type ColorScheme = "light" | "dark";

/** Low → high magnitude. */
export const HEAT_RAMP: Record<ColorScheme, readonly string[]> = {
  light: ["#4ec36b", "#1fa287", "#27808e", "#365c8d", "#46327e", "#440154"],
  dark: ["#355f8d", "#26828e", "#20a386", "#4ec36b", "#a2da37", "#fde725"],
};

/** Chart chrome per mode (text tokens, never series colors, for all text). */
export const CHART_THEME: Record<
  ColorScheme,
  { surface: string; text: string; muted: string; grid: string; zero: string; hatch: string }
> = {
  light: {
    surface: "#ffffff",
    text: "#171717",
    muted: "#525252",
    grid: "#e5e5e5",
    zero: "#f1f1f3",
    hatch: "rgba(255,255,255,0.75)",
  },
  dark: {
    surface: "#171717", // the dark card surface the charts sit on
    text: "#ededed",
    muted: "#a3a3a3",
    grid: "#262626",
    zero: "#1f1f23",
    hatch: "rgba(0,0,0,0.6)",
  },
};

function nice(x: number): number {
  const e = 10 ** Math.floor(Math.log10(x));
  const f = x / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}

/**
 * Upper bounds of the classes below the top one, roughly log-spaced and rounded to 1-2-5
 * numbers. Fire counts are very skewed (a jhum March can be 1000× a monsoon month), so a
 * linear scale would paint almost every cell the same color.
 * Example (6 classes): max 4877 → [2, 20, 50, 200, 1000] → (0,2] (2,20] … (1000,4877].
 */
export function heatBreaks(max: number, classes = HEAT_RAMP.light.length): number[] {
  if (!(max > 0)) return [];
  const out: number[] = [];
  for (let i = 1; i < classes; i++) {
    const raw = (1 + max) ** (i / classes) - 1;
    if (raw <= 0) continue;
    const b = nice(raw);
    if (b < max && (out.length === 0 || b > out[out.length - 1])) out.push(b);
  }
  return out;
}

export type HeatClass = { min: number; max: number; color: string; label: string };

/** Classes for values > 0 (zero is drawn separately as a recessive "no fire" cell). */
export function heatClasses(max: number, scheme: ColorScheme): HeatClass[] {
  const ramp = HEAT_RAMP[scheme];
  const bounds = [0, ...heatBreaks(max, ramp.length), Math.max(max, 1)];
  // Spread the available classes over the whole ramp so the top class is always the darkest
  // (light) / brightest (dark), even when fewer classes are needed.
  const n = bounds.length - 1;
  return Array.from({ length: n }, (_, i) => {
    const color = ramp[n === 1 ? ramp.length - 1 : Math.round((i * (ramp.length - 1)) / (n - 1))];
    const lo = bounds[i];
    const hi = bounds[i + 1];
    const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return {
      min: lo,
      max: hi,
      color,
      label: i === n - 1 ? `> ${fmt(lo)}` : `${fmt(lo)}–${fmt(hi)}`,
    };
  });
}

/**
 * Categorical series slots in fixed order (dataviz skill reference palette; the first three
 * validate in every pairing in both modes). Assigned by role, never by rank:
 * 1 = harmonized / the value being analysed, 2 = MODIS or the comparison, 3 = VIIRS.
 */
export const SERIES: Record<ColorScheme, { s1: string; s2: string; s3: string }> = {
  light: { s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a" },
  dark: { s1: "#3987e5", s2: "#d95926", s3: "#199e70" },
};

/** Status colors (fixed, never themed); always shown with an icon and a text label. */
export const STATUS = { warning: "#fab219", critical: "#d03b3b" } as const;
