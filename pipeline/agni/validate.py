"""Validation: leave-one-year-out (LOYO) cross-validation, error metrics and uncertainty bands.

For each calibration year y, a model is fitted on all OTHER years and predicts year y. The
pooled held-out predictions are scored at four levels:
  cell    every cell-month (0.1°)
  tile    1°-tile month totals (~100 cells, the size of a typical user area)  ← model selection
  zone    activity-zone month totals
  region  region month totals
Selection uses the tile level: zone/region totals average away spatial bias (a model can be
right on average but wrong in the hills and wrong the other way in the plains).
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np
import pandas as pd

from agni.calibrate import make_model

LEVELS = ("cell", "tile", "zone", "region")
SELECTION_LEVEL = "tile"


def metrics(obs: np.ndarray, pred: np.ndarray) -> dict:
    """n, Pearson r, R² (1 − SSres/SStot), MAE, normalized MAE (MAE / mean obs), bias %."""
    obs = np.asarray(obs, dtype="float64")
    pred = np.asarray(pred, dtype="float64")
    n = len(obs)
    mean_obs = float(obs.mean()) if n else 0.0
    ss_tot = float(np.sum((obs - mean_obs) ** 2))
    ss_res = float(np.sum((obs - pred) ** 2))
    r = float(np.corrcoef(obs, pred)[0, 1]) if n > 1 and obs.std() > 0 and pred.std() > 0 else None
    mae = float(np.mean(np.abs(pred - obs))) if n else 0.0
    total = float(obs.sum())
    return {
        "n": n,
        "r": None if r is None else round(r, 4),
        "r2": round(1 - ss_res / ss_tot, 4) if ss_tot > 0 else None,
        "mae": round(mae, 4),
        "nmae": round(mae / mean_obs, 4) if mean_obs > 0 else None,
        "bias_pct": round(100 * (float(pred.sum()) - total) / total, 2) if total > 0 else None,
    }


def aggregate_levels(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """df columns: tile, zone, month, obs, pred → frames at every validation level."""
    return {
        "cell": df[["obs", "pred"]],
        "tile": df.groupby(["tile", "month"], observed=True)[["obs", "pred"]].sum(),
        "zone": df.groupby(["zone", "month"], observed=True)[["obs", "pred"]].sum(),
        "region": df.groupby("month")[["obs", "pred"]].sum(),
    }


def score(df: pd.DataFrame) -> dict:
    return {
        level: metrics(frame["obs"].to_numpy(), frame["pred"].to_numpy())
        for level, frame in aggregate_levels(df).items()
    }


def loyo(
    pairs: pd.DataFrame,
    kind: str,
    extra_inputs: dict[str, str] | None = None,
    on_fold: Callable[[int, pd.DataFrame], None] | None = None,
) -> pd.DataFrame:
    """Held-out predictions for every pair.

    pairs columns: year, tile, zone, season, m, v (+ any columns named in extra_inputs).
    extra_inputs maps an output column to an alternative source column, predicted with the same
    fold model (e.g. {"pred_terra": "m_terra"} for the Terra-only path).
    on_fold(year, train) is called with each training set (used by the no-leakage test).
    """
    out = pd.DataFrame(index=pairs.index)
    out["pred"] = np.nan
    for col in extra_inputs or {}:
        out[col] = np.nan
    for year in sorted(pairs["year"].unique()):
        test_mask = (pairs["year"] == year).to_numpy()
        train = pairs.loc[~test_mask]
        if on_fold:
            on_fold(int(year), train)
        model = make_model(kind).fit(train)
        test = pairs.loc[test_mask]
        out.loc[test_mask, "pred"] = model.predict(test)
        for col, src in (extra_inputs or {}).items():
            out.loc[test_mask, col] = model.predict(test.assign(m=test[src]))
    return out


# Relative uncertainty is larger for small totals, so bands depend on the size of the
# predicted tile-month total.
SIZE_BINS = [-np.inf, 10, 100, 1000, np.inf]
SIZE_LABELS = ["<10", "10-100", "100-1000", ">1000"]
MIN_BAND_SAMPLES = 30  # tile-months needed for a bin's own P10/P90


def _tile_month_pred(df: pd.DataFrame, pred: np.ndarray) -> pd.Series:
    """Each row's predicted tile-month total (the scale the bands are calibrated at)."""
    return pd.Series(pred, index=df.index).groupby([df["tile"], df["month"]]).transform("sum")


def relative_bands(df: pd.DataFrame, q=(0.1, 0.9)) -> pd.DataFrame:
    """P10/P90 of observed ÷ predicted for held-out TILE-MONTH totals, per season × size bin.

    df columns: tile, month, season, obs, pred. Returns columns r_lo ≤ 1 ≤ r_hi.
    """
    tm = df.groupby(["tile", "month", "season"], observed=True)[["obs", "pred"]].sum().reset_index()
    tm = tm[tm["pred"] > 0]
    tm["size"] = pd.cut(tm["pred"], SIZE_BINS, labels=SIZE_LABELS)
    tm["ratio"] = tm["obs"] / tm["pred"]
    g = tm.groupby(["season", "size"], observed=True)["ratio"]
    out = pd.DataFrame({"r_lo": g.quantile(q[0]), "r_hi": g.quantile(q[1]), "n": g.size()})
    # Too few samples for a P10/P90: use the same size bin pooled over both seasons.
    pooled = tm.groupby("size", observed=True)["ratio"]
    pooled = pd.DataFrame({"r_lo": pooled.quantile(q[0]), "r_hi": pooled.quantile(q[1])})
    thin = out["n"] < MIN_BAND_SAMPLES
    for idx in out.index[thin]:
        out.loc[idx, ["r_lo", "r_hi"]] = pooled.loc[idx[1], ["r_lo", "r_hi"]].to_numpy()
    out["r_lo"] = out["r_lo"].clip(upper=1.0)
    out["r_hi"] = out["r_hi"].clip(lower=1.0)
    return out


def apply_bands(
    df: pd.DataFrame, pred: np.ndarray, bands: pd.DataFrame
) -> tuple[np.ndarray, np.ndarray]:
    """Cell-level lo/hi = pred × (r_lo, r_hi) of its season and tile-month size bin.

    Summed over an area, these give the relative uncertainty of area totals measured in
    validation (they are NOT meant to describe a single 0.1° cell, whose error is larger).
    """
    size = pd.cut(_tile_month_pred(df, pred), SIZE_BINS, labels=SIZE_LABELS).astype(str)
    key = pd.MultiIndex.from_arrays([df["season"].astype(str).to_numpy(), size.to_numpy()])
    b = bands.copy()
    b.index = pd.MultiIndex.from_arrays(
        [b.index.get_level_values(0).astype(str), b.index.get_level_values(1).astype(str)]
    )
    looked = b.reindex(key)
    widest = (b["r_lo"].min(), b["r_hi"].max())
    r_lo = looked["r_lo"].fillna(widest[0]).to_numpy()
    r_hi = looked["r_hi"].fillna(widest[1]).to_numpy()
    return pred * r_lo, pred * r_hi


def bands_table(bands: pd.DataFrame) -> list[dict]:
    """JSON-friendly version for the model report."""
    return [
        {
            "season": s,
            "size": z,
            "r_lo": round(float(r.r_lo), 3),
            "r_hi": round(float(r.r_hi), 3),
            "n": int(r.n),
        }
        for (s, z), r in bands.iterrows()
    ]
