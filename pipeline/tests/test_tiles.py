import gzip
import json

import numpy as np
import pandas as pd

from agni import tiles


def test_tile_keys_and_edges():
    keys = tiles.tile_keys(np.array([22.65, 28.0, 20.0]), np.array([92.25, 97.0, 86.0]))
    assert keys == ["t22_092", "t27_096", "t20_086"]


def test_write_tiles_rows_manifest_and_reproducibility(tmp_path, det_frame):
    det = det_frame(
        [
            {"lat": 22.65, "lon": 92.25, "acq_date": "2010-03-05", "sensor": "MODIS_A"},
            {"lat": 22.10, "lon": 89.20, "acq_date": "2015-01-02", "sensor": "VIIRS_SNPP"},
            {"lat": 22.11, "lon": 89.21, "acq_date": "2014-01-02", "sensor": "VIIRS_SNPP"},
        ]
    )
    m1 = tiles.write_tiles(det, tmp_path / "a", "test")
    m2 = tiles.write_tiles(det, tmp_path / "b", "test")

    assert m1["total_rows"] == 3
    assert [t["key"] for t in m1["tiles"]] == ["t22_089", "t22_092"]
    assert [t["sha256"] for t in m1["tiles"]] == [t["sha256"] for t in m2["tiles"]]
    assert (
        json.loads((tmp_path / "a" / "manifest.json").read_text())["columns"] == tiles.TILE_COLUMNS
    )

    with gzip.open(tmp_path / "a" / "t22_089.csv.gz", "rt") as fh:
        df = pd.read_csv(fh)
    assert df.columns.tolist() == tiles.TILE_COLUMNS
    assert df["date"].tolist() == ["2014-01-02", "2015-01-02"]  # sorted by date
    assert df["time_utc"].astype(str).str.zfill(4).tolist() == ["0730", "0730"]
