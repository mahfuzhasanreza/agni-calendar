/** Shape of GET /api/method (written by pipeline/agni/harmonize.py into model_run). */

export type Score = {
  n: number;
  r: number | null;
  r2: number | null;
  mae: number;
  nmae: number | null;
  bias_pct: number | null;
};
export type Levels = { cell: Score; tile: Score; zone: Score; region: Score };
export type BandRow = { season: string; size: string; r_lo: number; r_hi: number; n: number };

export type MetricReport = {
  models: Record<string, Levels>;
  terra_only_path: Levels;
  n20_to_snpp: Levels;
  yearly_ratio: Record<string, number>;
  bands: { definition: string; calibrated: BandRow[]; terra_only: BandRow[]; n20: BandRow[] };
};

export type MethodResponse = {
  modelVersion: string;
  metric: string;
  method: string;
  gridRes: number;
  calibration: { from: number; to: number };
  notes: string | null;
  createdAt: string;
  report: {
    calibration_window: [string, string];
    snpp_last_full_month: string;
    snpp_outage_months: string[];
    zones: { basis: string; edges: number[]; cells_per_zone: Record<string, number> };
    by_metric: Record<string, MetricReport>;
    chosen: Record<string, string>;
    headline_metric: string;
    selection_rule: string;
  };
  cvPredictions: {
    metric: string;
    level: string;
    months: string[];
    observed: number[];
    predicted: Record<string, number[]>;
  };
};

export const MODEL_LABELS: Record<string, string> = {
  local_ratio: "Local ratio (1° tile × season)",
  ratio: "Ratio (activity zone × season)",
  quantile_mapping: "Quantile mapping",
  loglog: "Log-log regression",
};

export const LEVEL_LABELS: Record<keyof Levels, string> = {
  cell: "single 0.1° cell",
  tile: "1° tile (~100 cells)",
  zone: "activity zone",
  region: "whole region",
};

export const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)} %`);
export const signedPct = (x: number | null) =>
  x === null ? "—" : `${x > 0 ? "+" : ""}${x.toFixed(1)} %`;
export const num = (x: number | null, digits = 3) => (x === null ? "—" : x.toFixed(digits));
