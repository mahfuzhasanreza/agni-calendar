"""End-to-end harmonization on synthetic data where the true answer is known."""

import numpy as np
import pandas as pd
import pytest

from agni import harmonize

# Two 1° tiles with different fire regimes (VIIRS/MODIS ratio 3 in the "hills", 8 in the
# "plains"); 4 cells each; record Nov 2000 - Nov 2026 like the real data.
HILLS = [260062, 260063, 270062, 270063]  # tile 22092
PLAINS = [240021, 240022, 250021, 250022]  # tile 22088
TRUE_RATIO = {**{c: 3.0 for c in HILLS}, **{c: 8.0 for c in PLAINS}}


def synthetic_obs(seed: int = 1) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    months = pd.date_range("2000-11-01", "2026-11-01", freq="MS")
    rows = []
    for cell, k in TRUE_RATIO.items():
        for mth in months:
            dry = mth.month in (11, 12, 1, 2, 3, 4, 5)
            terra = int(rng.poisson(6 if dry else 1))
            aqua = 0 if mth < pd.Timestamp("2002-07-01") else int(rng.poisson(20 if dry else 3))
            # Terra-only months: Aqua would have seen ~3.3x Terra.
            truth_m = (
                terra + aqua if aqua or mth >= pd.Timestamp("2002-07-01") else terra * (26 / 6)
            )
            snpp = round(k * (terra + aqua)) if mth >= pd.Timestamp("2012-01-01") else 0
            if mth == pd.Timestamp("2026-11-01"):
                snpp = 0  # S-NPP has stopped
            n20 = round(k * (terra + aqua)) if mth >= pd.Timestamp("2018-04-01") else 0
            rows.append(
                {
                    "cell_id": cell,
                    "month": mth,
                    "det_modis_t": terra,
                    "det_modis_a": aqua,
                    "det_viirs_snpp": snpp,
                    "det_viirs_n20": n20,
                    "fd_modis": min(terra + aqua, 30),
                    "fd_modis_t": min(terra, 30),
                    "fd_viirs_snpp": min(snpp, 30),
                    "fd_viirs_n20": min(n20, 30),
                    "_truth_m": truth_m,
                }
            )
    return pd.DataFrame(rows)


@pytest.fixture(scope="module")
def result():
    obs = synthetic_obs()
    nrt = {pd.Timestamp("2026-09-01"), pd.Timestamp("2026-10-01")}
    cm, model_run, rows, _zone_rows, _zone = harmonize.run(obs.drop(columns="_truth_m"), nrt)
    return obs, cm, model_run, rows


def test_local_ratio_is_selected_when_ratios_differ_by_place(result):
    _, _, model_run, _ = result
    assert model_run["method"] == "local_ratio"
    report = model_run["metrics"]
    tile = report["by_metric"]["detections"]["models"]["local_ratio"]["tile"]
    assert tile["r2"] > 0.95
    assert report["snpp_last_full_month"] == "2026-10"


def test_pre_2012_values_are_in_viirs_units(result):
    obs, cm, _, _ = result
    era = (cm["month"] >= "2003-01-01") & (cm["month"] < "2012-01-01")
    got = cm[era].groupby("cell_id")["harm"].sum()
    m = (
        obs[era.to_numpy()]
        .assign(M=lambda d: d.det_modis_t + d.det_modis_a)
        .groupby("cell_id")["M"]
        .sum()
    )
    for cell, k in TRUE_RATIO.items():
        assert got[cell] / m[cell] == pytest.approx(k, rel=0.05)


def test_the_2012_jump_disappears(result):
    obs, cm, _, _ = result
    year = cm["month"].dt.year
    harm = cm.groupby(year)["harm"].sum()
    raw = obs.assign(y=obs["month"].dt.year)
    naive = np.where(
        raw["month"] < "2012-02-01", raw.det_modis_t + raw.det_modis_a, raw.det_viirs_snpp
    )
    naive = pd.Series(naive).groupby(raw["y"].to_numpy()).sum()
    assert naive.loc[2013] / naive.loc[2010] > 3  # the fake jump
    assert harm.loc[2013] / harm.loc[2010] == pytest.approx(1.0, abs=0.25)


def test_flags_follow_the_sensor_eras(result):
    _, cm, _, _ = result
    flag = cm.set_index("month")["source_flag"].groupby(level=0).first()
    assert flag["2001-06-01"] == "terra_only_calibrated"
    assert flag["2005-06-01"] == "calibrated"
    assert flag["2015-06-01"] == "observed"
    assert flag["2026-09-01"] == "observed_nrt"
    assert flag["2026-11-01"] == "n20_calibrated"


def test_observed_months_are_exact_and_bands_contain_estimates(result):
    _, cm, _, _ = result
    obs_rows = cm[cm["source_flag"] == "observed"]
    assert (obs_rows["harm"] == obs_rows["det_viirs_snpp"]).all()
    assert (obs_rows["harm_lo"] == obs_rows["harm"]).all()
    est = cm[cm["source_flag"] != "observed"]
    assert (est["harm_lo"] <= est["harm"] + 1e-6).all()
    assert (est["harm_hi"] >= est["harm"] - 1e-6).all()


def test_november_2026_uses_noaa20_in_snpp_units(result):
    obs, cm, _, _ = result
    nov = cm[cm["month"] == "2026-11-01"].set_index("cell_id")
    n20 = obs[obs["month"] == "2026-11-01"].set_index("cell_id")["det_viirs_n20"]
    assert nov["harm"].sum() == pytest.approx(n20.sum(), rel=0.05)  # N20 ≈ S-NPP here


def test_calibration_rows_are_serializable(result):
    import json

    _, _, model_run, rows = result
    json.dumps(model_run)
    json.dumps(rows)
    assert {r["metric"] for r in rows} == {"detections", "fire_days"}
