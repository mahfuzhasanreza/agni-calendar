"""Read FIRMS CSV files (archive and NRT) into one normalized, memory-compact table.

Verified FIRMS header (CLAUDE.md §4.2); NRT files have the same columns without `type`:
latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,
confidence,version,bright_t31,frp,daynight,type

Memory: the full region is ~6.6 M rows. Text columns use fixed categorical dtypes (1 byte per
row instead of a Python string), and acq_time is an integer HHMM, so the table fits in well
under 1 GB.
"""

from pathlib import Path

import pandas as pd
from pandas.api.types import CategoricalDtype

from agni.config import SENSORS

REQUIRED = [
    "latitude",
    "longitude",
    "brightness",
    "acq_date",
    "acq_time",
    "satellite",
    "confidence",
    "bright_t31",
    "frp",
    "daynight",
]

# FIRMS `satellite` values → our sensor codes. Older files use single letters.
SATELLITE_TO_SENSOR = {
    "Terra": "MODIS_T",
    "T": "MODIS_T",
    "Aqua": "MODIS_A",
    "A": "MODIS_A",
    "SNPP": "VIIRS_SNPP",
    "N": "VIIRS_SNPP",
    "NPP": "VIIRS_SNPP",
    "N20": "VIIRS_N20",
    "NOAA-20": "VIIRS_N20",
    "J1": "VIIRS_N20",
    "N21": "VIIRS_N21",
    "NOAA-21": "VIIRS_N21",
    "J2": "VIIRS_N21",
}

# Fixed categories, so frames from different files concatenate without falling back to object.
SATELLITE_DTYPE = CategoricalDtype(sorted(SATELLITE_TO_SENSOR))
SENSOR_DTYPE = CategoricalDtype(list(SENSORS))
# MODIS confidence is 0-100, VIIRS is l / n / h.
CONFIDENCE_DTYPE = CategoricalDtype([str(i) for i in range(101)] + ["l", "n", "h"])
DAYNIGHT_DTYPE = CategoricalDtype(["D", "N"])
SOURCE_DTYPE = CategoricalDtype(["archive", "nrt"])

READ_DTYPES = {
    "latitude": "float64",
    "longitude": "float64",
    "brightness": "float32",
    "acq_time": "int16",  # HHMM UTC as a number (zero-padded again on output)
    "satellite": "category",
    "confidence": "category",
    "bright_t31": "float32",
    "frp": "float32",
    "daynight": "category",
    "type": "Int8",
}

COLUMNS = [
    "lat",
    "lon",
    "acq_date",
    "acq_time",
    "satellite",
    "sensor",
    "confidence",
    "brightness",
    "bright_t31",
    "frp",
    "daynight",
    "type",
    "source",
]


class SchemaError(ValueError):
    """A FIRMS file does not have the expected columns or values."""


def _to_fixed(series: pd.Series, dtype: CategoricalDtype, name: str, path: Path) -> pd.Series:
    """Re-label a categorical column onto a fixed dtype (no per-row strings are created)."""
    if not isinstance(series.dtype, CategoricalDtype):
        series = series.astype("category")
    # pandas ≥ 3 infers numeric categories (e.g. MODIS confidence 60, not "60"): relabel the
    # (few) categories as strings so they match the fixed dtype.
    series = series.cat.rename_categories([str(c) for c in series.cat.categories])
    unknown = sorted(set(series.cat.categories) - set(dtype.categories))
    if unknown:
        raise SchemaError(f"{path.name}: unknown {name} values {unknown[:10]}")
    if series.isna().any():
        raise SchemaError(f"{path.name}: empty {name} values")
    return series.cat.set_categories(dtype.categories)


def read_firms_csv(path: Path | str) -> pd.DataFrame:
    """Read one FIRMS CSV (.csv or .csv.gz) and normalize it.

    Output columns (see COLUMNS): acq_date is datetime64, acq_time is int HHMM, type is Int8
    (NA for NRT), source is "archive" or "nrt"; text columns are fixed categoricals.
    """
    path = Path(path)
    header = pd.read_csv(path, nrows=0).columns.tolist()
    missing = [c for c in REQUIRED if c not in header]
    if missing:
        raise SchemaError(f"{path.name}: missing columns {missing}")

    has_type = "type" in header
    usecols = [*REQUIRED, *(["type"] if has_type else [])]
    df = pd.read_csv(
        path, usecols=usecols, dtype={k: v for k, v in READ_DTYPES.items() if k in usecols}
    )
    # Strict parse; also yields datetime64 for header-only files.
    df["acq_date"] = pd.to_datetime(df["acq_date"], format="%Y-%m-%d")
    if not has_type:
        df["type"] = pd.array([pd.NA] * len(df), dtype="Int8")

    # Satellites first (better error message), then the derived sensor.
    df["satellite"] = _to_fixed(df["satellite"], SATELLITE_DTYPE, "satellite", path)
    sensor_of = pd.Series(SATELLITE_TO_SENSOR)
    codes = df["satellite"].cat.codes.to_numpy()
    sensor_by_code = sensor_of.reindex(SATELLITE_DTYPE.categories).to_numpy()
    df["sensor"] = pd.Categorical(sensor_by_code[codes], dtype=SENSOR_DTYPE)
    df["confidence"] = _to_fixed(df["confidence"], CONFIDENCE_DTYPE, "confidence", path)
    df["daynight"] = _to_fixed(df["daynight"], DAYNIGHT_DTYPE, "daynight", path)
    # Archive files have `type`; NRT files don't (and their names start with fire_nrt_).
    source = "archive" if has_type else "nrt"
    df["source"] = pd.Categorical([source] * len(df), dtype=SOURCE_DTYPE)

    return df.rename(columns={"latitude": "lat", "longitude": "lon"})[COLUMNS]


def find_firms_files(raw_dir: Path | str) -> list[Path]:
    """All FIRMS CSVs under raw_dir (FIRMS names them fire_archive_* / fire_nrt_*)."""
    root = Path(raw_dir)
    files = sorted(root.rglob("fire_*.csv")) + sorted(root.rglob("fire_*.csv.gz"))
    if not files:
        raise FileNotFoundError(f"no fire_*.csv files under {raw_dir}")
    return files


def read_all(raw_dir: Path | str) -> pd.DataFrame:
    """Read and concatenate every FIRMS file under raw_dir."""
    frames = [read_firms_csv(p) for p in find_firms_files(raw_dir)]
    return pd.concat(frames, ignore_index=True)
