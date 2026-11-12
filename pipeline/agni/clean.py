"""Cleaning rules (CLAUDE.md §5.1).

- Keep vegetation fires only: archive `type == 0`; NRT rows (no type) pass through the
  static-source mask instead.
- Drop NRT rows on dates already covered by the archive for the same sensor (archive wins).
- Confidence class for every row; `qualified` = passes the analytics filter
  (MODIS confidence ≥ 30, VIIRS n/h). Unqualified rows stay in the export tiles, flagged.

Confidence rules are evaluated once per category value (≈104 values) and broadcast through
the category codes, so millions of rows need no per-row string work. Numeric values only occur
for MODIS and letters only for VIIRS, so the value alone determines the rule.
"""

import numpy as np
import pandas as pd
from pandas.api.types import CategoricalDtype

from agni import grid
from agni.config import DEFAULT, Config
from agni.static_mask import build_static_set, on_static_source

CONF_CLASS_DTYPE = CategoricalDtype(["low", "nominal", "high"])
VIIRS_CLASS = {"l": "low", "n": "nominal", "h": "high"}


def _class_of(value: str) -> str:
    if value in VIIRS_CLASS:
        return VIIRS_CLASS[value]
    n = int(value)  # MODIS, FIRMS guidance: <30 low, 30-79 nominal, ≥80 high
    return "high" if n >= 80 else "nominal" if n >= 30 else "low"


def _qualified_value(value: str, cfg: Config) -> bool:
    if value in VIIRS_CLASS:
        return value in cfg.viirs_confidences
    return int(value) >= cfg.modis_min_confidence


def _per_category(series: pd.Series, values: list) -> np.ndarray:
    codes = series.cat.codes.to_numpy()
    if (codes < 0).any():
        raise ValueError("missing confidence values")
    return np.asarray(values)[codes]


def confidence_class(df: pd.DataFrame) -> pd.Categorical:
    cats = df["confidence"].cat.categories
    return pd.Categorical(
        _per_category(df["confidence"], [_class_of(c) for c in cats]), dtype=CONF_CLASS_DTYPE
    )


def is_qualified(df: pd.DataFrame, cfg: Config = DEFAULT) -> np.ndarray:
    cats = df["confidence"].cat.categories
    return _per_category(df["confidence"], [_qualified_value(c, cfg) for c in cats]).astype(bool)


def drop_nrt_overlap(df: pd.DataFrame) -> pd.DataFrame:
    """Remove NRT rows dated on or before the last archive date of the same sensor."""
    is_nrt = (df["source"] == "nrt").to_numpy()
    if not is_nrt.any():
        return df
    last_archive = (
        df.loc[~is_nrt].groupby("sensor", observed=True)["acq_date"].max().rename(index=str)
    )
    nrt = df.loc[is_nrt]  # small (thousands of rows)
    cutoff = nrt["sensor"].astype(str).map(last_archive)
    overlap = cutoff.notna() & (nrt["acq_date"] <= cutoff)
    return df.drop(index=nrt.index[overlap.to_numpy()])


def clean(df: pd.DataFrame, cfg: Config = DEFAULT) -> pd.DataFrame:
    """Apply all cleaning rules; adds conf_class, qualified and cell_id."""
    df = df[grid.inside(df["lat"].to_numpy(), df["lon"].to_numpy(), cfg)]
    df = drop_nrt_overlap(df)

    is_archive = (df["source"] == "archive").to_numpy()
    static = build_static_set(df.loc[is_archive], cfg)
    nrt = df.loc[~is_archive]
    nrt_keep = nrt.index[~on_static_source(nrt, static, cfg)]
    keep = (is_archive & (df["type"] == 0).fillna(False).to_numpy()) | df.index.isin(nrt_keep)
    df = df.loc[keep].reset_index(drop=True)

    df["conf_class"] = confidence_class(df)
    df["qualified"] = is_qualified(df, cfg)
    df["cell_id"] = grid.cell_ids(df["lat"].to_numpy(), df["lon"].to_numpy(), cfg).astype("int32")
    return df.sort_values(
        ["acq_date", "acq_time", "sensor", "lat", "lon"], ignore_index=True, kind="mergesort"
    )
