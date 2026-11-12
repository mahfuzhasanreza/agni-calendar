from pathlib import Path

import pandas as pd
import pytest

REPO = Path(__file__).resolve().parents[2]
SAMPLE_DIR = REPO / "data" / "sample"

ARCHIVE_HEADER = (
    "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,"
    "confidence,version,bright_t31,frp,daynight,type"
)
NRT_HEADER = ARCHIVE_HEADER.rsplit(",", 1)[0]


def firms_row(
    lat: float,
    lon: float,
    date: str,
    satellite: str = "Aqua",
    confidence: str = "60",
    type_: int | None = 0,
    time: str = "0730",
    version: str | None = None,
) -> str:
    """One CSV line in real FIRMS format (archive if type_ is not None, else NRT)."""
    instrument = "MODIS" if satellite in ("Terra", "Aqua") else "VIIRS"
    if version is None:
        version = ("6.03" if instrument == "MODIS" else "2") + ("" if type_ is not None else "NRT")
    cols = [
        f"{lat}",
        f"{lon}",
        "320.5",
        "1.0",
        "1.0",
        date,
        time,
        satellite,
        instrument,
        confidence,
        version,
        "295.1",
        "5.5",
        "D",
    ]
    if type_ is not None:
        cols.append(str(type_))
    return ",".join(cols)


@pytest.fixture
def write_csv(tmp_path: Path):
    """write_csv(name, rows, nrt=False) → path of a FIRMS-format CSV in tmp_path/raw."""
    raw = tmp_path / "raw"
    raw.mkdir(exist_ok=True)

    def _write(name: str, rows: list[str], nrt: bool = False) -> Path:
        path = raw / name
        path.write_text("\n".join([NRT_HEADER if nrt else ARCHIVE_HEADER, *rows]) + "\n")
        return path

    return _write


@pytest.fixture
def det_frame():
    """Build a cleaned-detections-like frame directly (for aggregate/naive/tiles tests)."""

    def _make(rows: list[dict]) -> pd.DataFrame:
        df = pd.DataFrame(rows)
        df["acq_date"] = pd.to_datetime(df["acq_date"])
        defaults = {
            "acq_time": 730,
            "satellite": "Aqua",
            "confidence": "60",
            "conf_class": "nominal",
            "qualified": True,
            "frp": 5.0,
            "brightness": 320.0,
            "bright_t31": 295.0,
            "daynight": "D",
            "type": 0,
            "source": "archive",
        }
        for k, v in defaults.items():
            # Rows may set a field only sometimes (e.g. qualified=False on one row).
            df[k] = df[k].fillna(v).astype(type(v)) if k in df else v
        from agni import grid

        df["cell_id"] = grid.cell_ids(df["lat"].to_numpy(), df["lon"].to_numpy())
        return df

    return _make
