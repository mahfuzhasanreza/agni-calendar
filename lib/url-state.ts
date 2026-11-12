/**
 * Shareable explorer state in the URL: ?preset=… or ?aoi=<JSON>, &mode=raw, &start=, &end=,
 * &month=. Defaults are omitted so links stay short. Anything invalid is ignored (a shared
 * link can never break the page).
 */
import { AoiError, resolveAoi } from "@/lib/aoi";
import { Aoi } from "@/lib/contracts";
import { MONTH_RE } from "@/lib/months";
import { RECORD_START } from "@/lib/sensors";

export type ExplorerState = {
  aoi: Aoi;
  mode: "harmonized" | "raw";
  start: string;
  end: string; // "" = through the latest data
  month: string; // "" = latest complete month
};

export const DEFAULT_STATE: ExplorerState = {
  aoi: { type: "preset", slug: "chittagong-hill-tracts" },
  mode: "harmonized",
  start: RECORD_START,
  end: "",
  month: "",
};

export function toSearchParams(s: ExplorerState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.aoi.type === "preset") p.set("preset", s.aoi.slug);
  else p.set("aoi", JSON.stringify(s.aoi));
  if (s.mode !== "harmonized") p.set("mode", s.mode);
  if (s.start !== RECORD_START) p.set("start", s.start);
  if (s.end) p.set("end", s.end);
  if (s.month) p.set("month", s.month);
  return p;
}

function validAoi(candidate: unknown): Aoi | null {
  const parsed = Aoi.safeParse(candidate);
  if (!parsed.success) return null;
  try {
    resolveAoi(parsed.data);
    return parsed.data;
  } catch (e) {
    if (e instanceof AoiError) return null;
    throw e;
  }
}

export function fromSearchParams(p: URLSearchParams): ExplorerState {
  const s: ExplorerState = { ...DEFAULT_STATE };
  const preset = p.get("preset");
  const aoiJson = p.get("aoi");
  let aoi: Aoi | null = null;
  if (preset) aoi = validAoi({ type: "preset", slug: preset });
  else if (aoiJson) {
    try {
      aoi = validAoi(JSON.parse(aoiJson));
    } catch {
      aoi = null;
    }
  }
  if (aoi) s.aoi = aoi;
  if (p.get("mode") === "raw") s.mode = "raw";
  for (const key of ["start", "end", "month"] as const) {
    const v = p.get(key);
    if (v && MONTH_RE.test(v)) s[key] = v;
  }
  return s;
}

/** Request URL for the analysis: presets use the CDN-cacheable GET. */
export function analyzeGetUrl(s: ExplorerState): string | null {
  if (s.aoi.type !== "preset") return null;
  const p = new URLSearchParams({ preset: s.aoi.slug, mode: s.mode, start: s.start });
  if (s.end) p.set("end", s.end);
  if (s.month) p.set("selectedMonth", s.month);
  return `/api/analyze?${p.toString()}`;
}
