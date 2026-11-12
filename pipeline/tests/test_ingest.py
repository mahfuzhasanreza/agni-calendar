import pandas as pd
import pytest

from agni import ingest
from tests.conftest import firms_row


def test_reads_archive_with_types_and_sensor(write_csv):
    path = write_csv(
        "fire_archive_x.csv",
        [firms_row(22.5, 92.1, "2005-03-01", "Terra", time="0430", type_=0)],
    )
    df = ingest.read_firms_csv(path)
    row = df.iloc[0]
    assert row["sensor"] == "MODIS_T"
    assert row["acq_time"] == 430  # HHMM as a number; tiles zero-pad it again
    assert row["source"] == "archive"
    assert row["type"] == 0
    assert pd.api.types.is_datetime64_any_dtype(df["acq_date"])


def test_nrt_file_has_no_type_and_is_marked_nrt(write_csv):
    path = write_csv(
        "fire_nrt_x.csv", [firms_row(22.5, 92.1, "2026-09-01", "N20", "n", None)], nrt=True
    )
    df = ingest.read_firms_csv(path)
    assert df.iloc[0]["source"] == "nrt"
    assert pd.isna(df.iloc[0]["type"])
    assert df.iloc[0]["sensor"] == "VIIRS_N20"


def test_header_only_file_still_has_datetime_dates(write_csv):
    df = ingest.read_firms_csv(write_csv("fire_nrt_empty.csv", [], nrt=True))
    assert df.empty
    assert pd.api.types.is_datetime64_any_dtype(df["acq_date"])


def test_missing_columns_fail_loudly(tmp_path):
    bad = tmp_path / "fire_bad.csv"
    bad.write_text("latitude,longitude,acq_date\n22,92,2020-01-01\n")
    with pytest.raises(ingest.SchemaError, match="missing columns"):
        ingest.read_firms_csv(bad)


def test_unknown_satellite_fails_loudly(write_csv):
    path = write_csv("fire_archive_x.csv", [firms_row(22.5, 92.1, "2020-01-01", "Landsat")])
    with pytest.raises(ingest.SchemaError, match="unknown satellite"):
        ingest.read_firms_csv(path)
