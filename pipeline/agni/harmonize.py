"""Build the harmonized series (CLAUDE.md §5.3-5.6) and its validation report.

Reference unit: VIIRS S-NPP-equivalent counts.

  Nov 2000 - Jun 2002  Terra only: scaled to Terra+Aqua, then calibrated  terra_only_calibrated
  Jul 2002 - Jan 2012  MODIS Terra+Aqua, calibrated                        calibrated
  Feb 2012 - last full S-NPP month: observed S-NPP                        observed / observed_nrt
     region-wide S-NPP outages: NOAA-20 calibrated, else MODIS       n20_calibrated / gap_filled
  after S-NPP ends     NOAA-20 calibrated onto S-NPP                       n20_calibrated

Every calibration is chosen and scored with leave-one-year-out validation (validate.py).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from agni.calibrate import CANDIDATES, make_model
from agni.config import DEFAULT, Config
from agni.validate import SELECTION_LEVEL, apply_bands, bands_table, loyo, relative_bands, score
from agni.zones import assign_zones, season_of, zone_rows

MODEL_VERSION = "v1"
AQUA_START = pd.Timestamp("2002-07-01")
TERRA_SCALE_YEARS = (2003, 2011)  # full Terra + Aqua years before VIIRS
SNPP_GAP_FRACTION = 0.5  # S-NPP below half of NOAA-20 region-wide → outage month
MIN_GAP_DETECTIONS = 200  # only judge months with enough NOAA-20 fire to compare
HEADLINE_SWITCH = 0.8  # use fire-days only if its tile-level nMAE is < 80 % of detections'

METRICS = {
    # metric: (MODIS source, Terra-only source, VIIRS S-NPP target, NOAA-20 source)
    "detections": ("modis_det", "det_modis_t", "det_viirs_snpp", "det_viirs_n20"),
    "fire_days": ("fd_modis", "fd_modis_t", "fd_viirs_snpp", "fd_viirs_n20"),
}


@dataclass
class Window:
    start: pd.Timestamp
    end: pd.Timestamp


def _region_sensor_months(obs: pd.DataFrame) -> tuple[pd.Timestamp, list[pd.Timestamp]]:
    """Last full S-NPP month and region-wide S-NPP outage months (both from the data)."""
    reg = obs.groupby("month")[["det_viirs_snpp", "det_viirs_n20"]].sum()
    full = reg[(reg["det_viirs_snpp"] > 0)]
    with_n20 = full["det_viirs_n20"] >= MIN_GAP_DETECTIONS
    ok = ~with_n20 | (full["det_viirs_snpp"] >= SNPP_GAP_FRACTION * full["det_viirs_n20"])
    last_full = full.index[ok.to_numpy()].max()
    both = reg[(reg.index <= last_full) & (reg["det_viirs_n20"] >= MIN_GAP_DETECTIONS)]
    gaps = both.index[
        (both["det_viirs_snpp"] < SNPP_GAP_FRACTION * both["det_viirs_n20"]).to_numpy()
    ]
    return last_full, list(gaps)


def _pairs(obs: pd.DataFrame, src: str, dst: str, months: pd.Series) -> pd.DataFrame:
    sel = obs[months.to_numpy()]
    return pd.DataFrame(
        {
            "cell_id": sel["cell_id"].to_numpy(),
            "month": sel["month"].to_numpy(),
            "year": sel["month"].dt.year.to_numpy(),
            "tile": sel["tile"].to_numpy(),
            "zone": sel["zone"].to_numpy(),
            "season": sel["season"].to_numpy(),
            "m": sel[src].to_numpy(dtype="float64"),
            "v": sel[dst].to_numpy(dtype="float64"),
        }
    )


def _cv_frame(pairs: pd.DataFrame, pred: np.ndarray) -> pd.DataFrame:
    return pairs[["tile", "zone", "season", "month", "m"]].assign(obs=pairs["v"], pred=pred)


def tile_of(cell_id: pd.Series, cfg: Config = DEFAULT) -> pd.Series:
    """1° tile code (floor(lat) * 1000 + floor(lon)) of each cell's center."""
    row, col = cell_id // 10_000, cell_id % 10_000
    lat = cfg.south + (row + 0.5) * cfg.grid_res
    lon = cfg.west + (col + 0.5) * cfg.grid_res
    return (np.floor(lat) * 1000 + np.floor(lon)).astype("int32")


def run(
    obs: pd.DataFrame, nrt_months: set[pd.Timestamp], cfg: Config = DEFAULT, calib_to: int = 2025
):
    """Returns (cell_month frame, model_run dict, calibration rows, zone rows, zone per cell)."""
    obs = obs.copy()
    obs["modis_det"] = obs["det_modis_t"] + obs["det_modis_a"]
    zone, zone_info = assign_zones(obs)
    obs["zone"] = obs["cell_id"].map(zone).astype("int16")
    obs["season"] = season_of(obs["month"])
    obs["tile"] = tile_of(obs["cell_id"], cfg)

    snpp_last_full, gaps = _region_sensor_months(obs)
    window = Window(
        pd.Timestamp(cfg.snpp_first_full_month + "-01"), pd.Timestamp(f"{calib_to}-12-01")
    )
    in_window = obs["month"].between(window.start, window.end) & ~obs["month"].isin(gaps)
    n20_window = obs["month"].between(
        pd.Timestamp("2018-04-01"), min(snpp_last_full, window.end)
    ) & ~obs["month"].isin(gaps)
    terra_window = obs["month"].dt.year.between(*TERRA_SCALE_YEARS)

    report: dict = {
        "calibration_window": [window.start.strftime("%Y-%m"), window.end.strftime("%Y-%m")],
        "snpp_last_full_month": snpp_last_full.strftime("%Y-%m"),
        "snpp_outage_months": [g.strftime("%Y-%m") for g in gaps],
        "zones": zone_info,
        "by_metric": {},
        "chosen": {},
    }
    fitted: dict = {}

    for metric, (src, terra_src, dst, n20_src) in METRICS.items():
        # Terra-only → Terra+Aqua scaling, per stratum (sum-preserving ratio).
        terra_pairs = _pairs(obs, terra_src, src, terra_window)
        terra_model = make_model("local_ratio").fit(terra_pairs)

        pairs = _pairs(obs, src, dst, in_window)
        pairs["m_terra"] = terra_model.predict(_pairs(obs, terra_src, dst, in_window))
        scores, cvs = {}, {}
        for kind in CANDIDATES:
            cv = loyo(pairs, kind, extra_inputs={"pred_terra": "m_terra"})
            cvs[kind] = cv
            scores[kind] = score(_cv_frame(pairs, cv["pred"].to_numpy()))
        best = min(scores, key=lambda k: scores[k][SELECTION_LEVEL]["mae"])
        report["by_metric"][metric] = {
            "models": scores,
            "terra_only_path": score(_cv_frame(pairs, cvs[best]["pred_terra"].to_numpy())),
            "yearly_ratio": {
                int(y): round(float(g["v"].sum() / g["m"].sum()), 3)
                for y, g in pairs.groupby("year")
                if g["m"].sum() > 0
            },
        }
        report["chosen"][metric] = best

        n20_pairs = _pairs(obs, n20_src, dst, n20_window)
        n20_cv = loyo(n20_pairs, best)
        report["by_metric"][metric]["n20_to_snpp"] = score(
            _cv_frame(n20_pairs, n20_cv["pred"].to_numpy())
        )

        bands = relative_bands(_cv_frame(pairs, cvs[best]["pred"].to_numpy()))
        terra_bands = relative_bands(_cv_frame(pairs, cvs[best]["pred_terra"].to_numpy()))
        n20_bands = relative_bands(_cv_frame(n20_pairs, n20_cv["pred"].to_numpy()))
        report["by_metric"][metric]["bands"] = {
            "definition": "P10-P90 of observed/predicted for held-out 1° tile-month totals",
            "calibrated": bands_table(bands),
            "terra_only": bands_table(terra_bands),
            "n20": bands_table(n20_bands),
        }
        fitted[metric] = {
            "terra": terra_model,
            "main": make_model(best).fit(pairs),
            "n20": make_model(best).fit(n20_pairs),
            "bands": bands,
            "terra_bands": terra_bands,
            "n20_bands": n20_bands,
            "cv": cvs,
            "pairs": pairs,
        }

    def nmae(metric: str) -> float:
        chosen = report["chosen"][metric]
        return report["by_metric"][metric]["models"][chosen][SELECTION_LEVEL]["nmae"]

    det_nmae, fd_nmae = nmae("detections"), nmae("fire_days")
    headline = "fire_days" if fd_nmae < HEADLINE_SWITCH * det_nmae else "detections"
    report["headline_metric"] = headline
    report["selection_rule"] = (
        "model: lowest MAE of 1° tile-month totals in leave-one-year-out CV; headline metric: "
        f"fire_days only if its tile-level nMAE < {HEADLINE_SWITCH} × detections'"
    )

    cell_month = _harmonized(
        obs, fitted[headline], METRICS[headline], snpp_last_full, gaps, nrt_months
    )

    best = report["chosen"][headline]
    pairs = fitted[headline]["pairs"]
    region = pairs[["month"]].assign(obs=pairs["v"])
    for kind, cv in fitted[headline]["cv"].items():
        region[kind] = cv["pred"].to_numpy()
    region = region.groupby("month").sum()
    cv_predictions = {
        "metric": headline,
        "level": "region-month totals, held-out (leave-one-year-out)",
        "months": [m.strftime("%Y-%m") for m in region.index],
        "observed": region["obs"].round(1).tolist(),
        "predicted": {k: region[k].round(1).tolist() for k in CANDIDATES},
    }

    model_run = {
        "model_version": MODEL_VERSION,
        "metric": headline,
        "method": best,
        "grid_res": cfg.grid_res,
        "calib_from": window.start.year,
        "calib_to": window.end.year,
        "metrics": report,
        "cv_predictions": cv_predictions,
        "notes": (
            f"MODIS → VIIRS S-NPP calibration by {best} (selected on held-out 1° tile-month "
            "totals); NOAA-20 → S-NPP after S-NPP ends; bands = P10-P90 of held-out "
            "observed/predicted for tile-month totals."
        ),
    }
    rows = []
    for metric in METRICS:
        f = fitted[metric]
        rows += f["main"].rows(MODEL_VERSION, metric)
        rows += f["terra"].rows(MODEL_VERSION, metric, season_label="terra_scale")
        rows += f["n20"].rows(MODEL_VERSION, metric, season_label="n20_scale")
    return cell_month, model_run, rows, zone_rows(zone_info), zone


def _harmonized(obs, fitted, cols, snpp_last_full, gaps, nrt_months) -> pd.DataFrame:
    src, terra_src, dst, n20_src = cols
    month = obs["month"]
    base = obs[["tile", "zone", "season", "month"]].copy()

    terra_only = (month < AQUA_START).to_numpy()
    modis_era = ((month >= AQUA_START) & (month < pd.Timestamp("2012-02-01"))).to_numpy()
    gap = month.isin(gaps).to_numpy()
    after = (month > snpp_last_full).to_numpy()
    observed = ~(terra_only | modis_era | gap | after)

    m = obs[src].to_numpy(dtype="float64").copy()
    m[terra_only] = fitted["terra"].predict(
        base[terra_only].assign(m=obs.loc[terra_only, terra_src])
    )

    harm = np.zeros(len(obs))
    lo = np.zeros(len(obs))
    hi = np.zeros(len(obs))
    flag = np.full(len(obs), "observed", dtype=object)

    def calibrated(sel, model, bands, source_values):
        frame = base[sel].assign(m=source_values)
        pred = model.predict(frame)
        b_lo, b_hi = apply_bands(frame, pred, bands)
        harm[sel], lo[sel], hi[sel] = pred, b_lo, b_hi

    calibrated(terra_only, fitted["main"], fitted["terra_bands"], m[terra_only])
    flag[terra_only] = "terra_only_calibrated"
    calibrated(modis_era, fitted["main"], fitted["bands"], m[modis_era])
    flag[modis_era] = "calibrated"

    n20 = obs[n20_src].to_numpy(dtype="float64")
    n20_ok = gap & (month >= pd.Timestamp("2018-04-01")).to_numpy()
    calibrated(n20_ok | after, fitted["n20"], fitted["n20_bands"], n20[n20_ok | after])
    flag[n20_ok | after] = "n20_calibrated"
    modis_fill = gap & ~n20_ok
    calibrated(modis_fill, fitted["main"], fitted["bands"], m[modis_fill])
    flag[modis_fill] = "gap_filled"

    v = obs[dst].to_numpy(dtype="float64")
    harm[observed] = lo[observed] = hi[observed] = v[observed]
    flag[observed & month.isin(nrt_months).to_numpy()] = "observed_nrt"

    out = obs[
        ["cell_id", "month", "det_modis_t", "det_modis_a", "det_viirs_snpp", "det_viirs_n20"]
    ].copy()
    out["modis_ref"] = m.astype("float32")
    out["harm"] = harm.astype("float32")
    out["harm_lo"] = lo.astype("float32")
    out["harm_hi"] = hi.astype("float32")
    out["source_flag"] = flag
    return out
