"""Regular lat/lon grid. Cell id = row * 10000 + col; row 0 is the southern edge.

The same formula is used in SQL (see load.py) so ids are identical everywhere.
"""

import numpy as np
import pandas as pd

from agni.config import DEFAULT, Config

ID_FACTOR = 10_000


def _index(values: np.ndarray, origin: float, res: float, n: int) -> np.ndarray:
    # Round before floor so that e.g. (22.3 - 20) / 0.1 = 22.999999999999996 lands in row 23.
    idx = np.floor(np.round((values - origin) / res, 6)).astype("int64")
    # Points exactly on the far edge (e.g. lat == north) belong to the last row/column.
    return np.where(idx == n, n - 1, idx)


def inside(lat: np.ndarray, lon: np.ndarray, cfg: Config = DEFAULT) -> np.ndarray:
    """Boolean mask of points inside the region bbox (edges inclusive)."""
    return (lat >= cfg.south) & (lat <= cfg.north) & (lon >= cfg.west) & (lon <= cfg.east)


def cell_ids(lat: np.ndarray, lon: np.ndarray, cfg: Config = DEFAULT) -> np.ndarray:
    """Cell id per point. Points outside the bbox must be removed first (see `inside`)."""
    lat = np.asarray(lat, dtype="float64")
    lon = np.asarray(lon, dtype="float64")
    if not inside(lat, lon, cfg).all():
        raise ValueError("cell_ids() got points outside the region bbox")
    row = _index(lat, cfg.south, cfg.grid_res, cfg.n_rows)
    col = _index(lon, cfg.west, cfg.grid_res, cfg.n_cols)
    return row * ID_FACTOR + col


def cells_frame(cfg: Config = DEFAULT) -> pd.DataFrame:
    """Every cell of the grid with its row, col and center (geometry is built in SQL)."""
    rows, cols = np.meshgrid(np.arange(cfg.n_rows), np.arange(cfg.n_cols), indexing="ij")
    rows, cols = rows.ravel(), cols.ravel()
    return pd.DataFrame(
        {
            "id": rows * ID_FACTOR + cols,
            "row": rows,
            "col": cols,
            "res": cfg.grid_res,
            "center_lat": np.round(cfg.south + (rows + 0.5) * cfg.grid_res, 6),
            "center_lon": np.round(cfg.west + (cols + 0.5) * cfg.grid_res, 6),
        }
    )
