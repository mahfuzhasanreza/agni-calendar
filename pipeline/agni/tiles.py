"""Detection export tiles (free-tier design, PLAN §4 `tiles`).

One gzip CSV per 1°×1° tile, named t{south}_{west} (e.g. t22_092 covers 22–23°N, 92–93°E),
plus manifest.json. Output is byte-for-byte reproducible (fixed gzip mtime, sorted rows), so
re-running the pipeline on the same input gives identical files and checksums.
"""

import gzip
import hashlib
import io
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from agni.config import DEFAULT, Config

TILE_COLUMNS = [
    "date",
    "time_utc",
    "lat",
    "lon",
    "sensor",
    "satellite",
    "confidence",
    "conf_class",
    "qualified",
    "frp",
    "brightness",
    "bright_t31",
    "daynight",
    "type",
    "source",
]


def tile_codes(lat: np.ndarray, lon: np.ndarray, cfg: Config = DEFAULT) -> np.ndarray:
    """Integer tile code south*1000 + west (cheap to group millions of rows by)."""
    d = cfg.tile_deg
    # Points on the region's north/east edge go to the last tile, like grid cells.
    s = np.minimum(np.floor(np.round(lat, 6) / d) * d, cfg.north - d).astype("int32")
    w = np.minimum(np.floor(np.round(lon, 6) / d) * d, cfg.east - d).astype("int32")
    return s * 1000 + w


def code_to_key(code: int) -> str:
    return f"t{code // 1000:02d}_{code % 1000:03d}"


def tile_keys(lat: np.ndarray, lon: np.ndarray, cfg: Config = DEFAULT) -> list[str]:
    return [code_to_key(int(c)) for c in tile_codes(lat, lon, cfg)]


def _tile_frame(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": df["acq_date"].dt.strftime("%Y-%m-%d"),
            "time_utc": df["acq_time"].astype("int32").astype(str).str.zfill(4),
            "lat": df["lat"].round(5),
            "lon": df["lon"].round(5),
            "sensor": df["sensor"],
            "satellite": df["satellite"],
            "confidence": df["confidence"],
            "conf_class": df["conf_class"],
            "qualified": df["qualified"].map({True: 1, False: 0}),
            "frp": df["frp"].round(2),
            "brightness": df["brightness"].round(2),
            "bright_t31": df["bright_t31"].round(2),
            "daynight": df["daynight"],
            "type": df["type"],
            "source": df["source"],
        }
    )[TILE_COLUMNS]


def write_tiles(
    det: pd.DataFrame, out_dir: Path | str, dataset_version: str, cfg: Config = DEFAULT
) -> dict:
    """Write tile files + manifest.json into out_dir (cleared first). Returns the manifest."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("t*_*.csv.gz"):
        old.unlink()

    codes = tile_codes(det["lat"].to_numpy(), det["lon"].to_numpy(), cfg)
    tiles = []
    for code in np.unique(codes):
        key = code_to_key(int(code))
        part = det.loc[codes == code].sort_values(
            ["acq_date", "acq_time", "sensor", "lat", "lon"], kind="mergesort"
        )
        text = _tile_frame(part).to_csv(index=False, lineterminator="\n")
        buf = io.BytesIO()
        with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0, compresslevel=9) as gz:
            gz.write(text.encode("utf-8"))
        data = buf.getvalue()
        (out / f"{key}.csv.gz").write_bytes(data)
        south, west = int(key[1:3]), int(key[4:7])
        tiles.append(
            {
                "key": key,
                "file": f"{key}.csv.gz",
                "bbox": [west, south, west + cfg.tile_deg, south + cfg.tile_deg],
                "rows": len(part),
                "date_min": part["acq_date"].min().strftime("%Y-%m-%d"),
                "date_max": part["acq_date"].max().strftime("%Y-%m-%d"),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )

    manifest = {
        "dataset_version": dataset_version,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "region_bbox": [cfg.west, cfg.south, cfg.east, cfg.north],
        "tile_deg": cfg.tile_deg,
        "columns": TILE_COLUMNS,
        "total_rows": int(sum(t["rows"] for t in tiles)),
        "tiles": tiles,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    return manifest
