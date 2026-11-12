"""Static-source mask for NRT detections.

NRT files have no `type` field, so industrial sources (brick kilns, gas flares) cannot be
dropped directly. The archive marks them as type=2 at fixed locations, so we snap archive
type=2 points to a ~0.5 km grid and drop NRT points falling on (or next to) those spots.
"""

import numpy as np
import pandas as pd

from agni.config import DEFAULT, Config


def _keys(lat: np.ndarray, lon: np.ndarray, snap: float) -> tuple[np.ndarray, np.ndarray]:
    return np.round(lat / snap).astype("int64"), np.round(lon / snap).astype("int64")


def build_static_set(archive: pd.DataFrame, cfg: Config = DEFAULT) -> set[tuple[int, int]]:
    """Snapped (lat, lon) keys of archive type=2 detections."""
    static = archive[archive["type"] == 2]
    ki, kj = _keys(static["lat"].to_numpy(), static["lon"].to_numpy(), cfg.static_snap_deg)
    return set(zip(ki.tolist(), kj.tolist(), strict=True))


def on_static_source(
    df: pd.DataFrame, static: set[tuple[int, int]], cfg: Config = DEFAULT
) -> np.ndarray:
    """True for rows within one snap cell (3×3 neighbourhood) of a known static source."""
    if not static or df.empty:
        return np.zeros(len(df), dtype=bool)
    ki, kj = _keys(df["lat"].to_numpy(), df["lon"].to_numpy(), cfg.static_snap_deg)
    hit = np.zeros(len(df), dtype=bool)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            hit |= np.fromiter(
                ((a + di, b + dj) in static for a, b in zip(ki, kj, strict=True)),
                dtype=bool,
                count=len(df),
            )
    return hit
