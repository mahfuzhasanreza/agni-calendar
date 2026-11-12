"""Calibration strata (CLAUDE.md §5, decisions 2026-11-12).

Zone = quartile of a cell's long-term MODIS activity (mean annual Terra + Aqua detections over
full MODIS years). Built from MODIS only, so the VIIRS target never leaks into the strata.
Season = dry (Nov-May, the burning season) or wet (Jun-Oct, monsoon).
"""

import numpy as np
import pandas as pd

ZONE_NAMES = {
    1: "Low activity",
    2: "Moderate activity",
    3: "High activity",
    4: "Very high activity",
}
DRY_MONTHS = frozenset({11, 12, 1, 2, 3, 4, 5})


def season_of(month: pd.Series) -> pd.Series:
    """'dry' for Nov-May, 'wet' for Jun-Oct."""
    return month.dt.month.isin(DRY_MONTHS).map({True: "dry", False: "wet"})


def assign_zones(
    obs: pd.DataFrame, years: tuple[int, int] = (2003, 2025)
) -> tuple[pd.Series, dict]:
    """Zone id (1-4) per cell_id and a description of the activity thresholds."""
    y0, y1 = years
    sub = obs[obs["month"].dt.year.between(y0, y1)]
    activity = sub.groupby("cell_id")[["det_modis_t", "det_modis_a"]].sum().sum(axis=1) / (
        y1 - y0 + 1
    )
    # Make sure every cell gets a zone, including cells only VIIRS ever saw (activity 0).
    activity = activity.reindex(obs["cell_id"].unique(), fill_value=0.0)
    positive = activity[activity > 0]
    edges = np.quantile(positive, [0.25, 0.5, 0.75]) if len(positive) else np.array([0, 0, 0])
    zone = pd.Series(
        1 + np.searchsorted(edges, activity.to_numpy(), side="right"), index=activity.index
    )
    zone[activity == 0] = 1
    zone = zone.clip(1, 4).astype("int16")
    zone.name = "zone_id"
    info = {
        "basis": f"mean annual MODIS (Terra + Aqua) detections per 0.1° cell, {y0}-{y1}",
        "edges": [round(float(e), 3) for e in edges],
        "cells_per_zone": {int(k): int(v) for k, v in zone.value_counts().sort_index().items()},
    }
    return zone, info


def zone_rows(info: dict) -> list[dict]:
    """Rows for the `zone` table."""
    e = info["edges"]
    ranges = [f"< {e[0]}", f"{e[0]}–{e[1]}", f"{e[1]}–{e[2]}", f"> {e[2]}"]
    return [
        {
            "id": z,
            "name": ZONE_NAMES[z],
            "description": f"{ranges[z - 1]} MODIS detections per cell per year ({info['basis']})",
        }
        for z in (1, 2, 3, 4)
    ]
