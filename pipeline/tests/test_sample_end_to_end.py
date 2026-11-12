"""The committed sample goes through the whole build exactly like the real data."""

import json
import os

import pandas as pd
import psycopg
import pytest

from agni import cli
from tests.conftest import SAMPLE_DIR


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    out = tmp_path_factory.mktemp("build")
    meta = cli.build(SAMPLE_DIR, out / "interim", out / "tiles", "sample")
    return out, meta


def test_sample_build_outputs(built):
    out, meta = built
    assert meta["rows_clean"] > 20_000
    assert set(meta["per_sensor"]) >= {"MODIS_T", "MODIS_A", "VIIRS_SNPP", "VIIRS_N20"}
    cm = pd.read_parquet(out / "interim" / "cell_month.parquet")
    assert cm["month"].min() == pd.Timestamp("2000-11-01")
    assert not cm.duplicated(["cell_id", "month"]).any()
    manifest = json.loads((out / "tiles" / "manifest.json").read_text())
    assert manifest["total_rows"] == meta["rows_clean"]


def test_sample_shows_the_2012_sensor_jump(built):
    """The naive series must show the fake jump (the problem harmonization fixes)."""
    out, _ = built
    cm = pd.read_parquet(out / "interim" / "cell_month.parquet")
    annual = cm.groupby(cm["month"].dt.year)["harm"].sum()
    assert annual.loc[2013] > 3 * annual.loc[2011]


def test_sample_calibrates_and_removes_most_of_the_jump(built):
    out, _ = built
    report = cli.calibrate(out / "interim")
    assert report["chosen"][report["headline_metric"]] in {
        "quantile_mapping",
        "loglog",
        "ratio",
        "local_ratio",
    }
    cm = pd.read_parquet(out / "interim" / "cell_month_v1.parquet")
    annual = cm.groupby(cm["month"].dt.year)["harm"].sum()
    naive = pd.read_parquet(out / "interim" / "cell_month.parquet")
    naive_annual = naive.groupby(naive["month"].dt.year)["harm"].sum()
    jump_raw = naive_annual.loc[2012:2014].mean() / naive_annual.loc[2009:2011].mean()
    jump_harm = annual.loc[2012:2014].mean() / annual.loc[2009:2011].mean()
    assert jump_raw > 2.5
    assert jump_harm < jump_raw / 2


@pytest.mark.db
@pytest.mark.skipif("AGNI_TEST_DATABASE_URL" not in os.environ, reason="no test database")
def test_load_into_postgis_is_idempotent(built):
    out, _ = built
    url = os.environ["AGNI_TEST_DATABASE_URL"]
    cli.calibrate(out / "interim")
    for _ in range(2):  # second run must give the same result
        cli.load(out / "interim", url, "sample")
    with psycopg.connect(url) as conn:
        n_cells, n_active = conn.execute(
            "SELECT count(*), count(*) FILTER (WHERE ever_active) FROM cell"
        ).fetchone()
        n_cm = conn.execute("SELECT count(*) FROM cell_month").fetchone()[0]
        active = conn.execute("SELECT model_version FROM model_run WHERE is_active").fetchall()
        n_zones = conn.execute("SELECT count(*) FROM zone").fetchone()[0]
        n_cal = conn.execute("SELECT count(*) FROM calibration_model").fetchone()[0]
        zoned = conn.execute(
            "SELECT count(*) FROM cell WHERE ever_active AND zone_id IS NOT NULL"
        ).fetchone()[0]
        flags = dict(
            conn.execute("SELECT source_flag, count(*) FROM cell_month GROUP BY 1").fetchall()
        )
        # Geometry of cell 260062 (22.6-22.7N, 92.2-92.3E) built in SQL matches the formula.
        bbox = conn.execute(
            "SELECT ST_XMin(geom), ST_YMin(geom), ST_XMax(geom), ST_YMax(geom) "
            "FROM cell WHERE id = 260062"
        ).fetchone()
    cm = pd.read_parquet(out / "interim" / "cell_month.parquet")
    assert n_cells == 8800
    assert n_active == cm["cell_id"].nunique()
    assert n_cm == len(cm)
    assert active == [("v1",)]
    assert n_zones == 4 and n_cal > 0
    assert zoned == n_active
    assert {"calibrated", "observed", "terra_only_calibrated"} <= set(flags)
    assert [round(v, 6) for v in bbox] == [92.2, 22.6, 92.3, 22.7]
