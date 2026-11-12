import numpy as np
import pandas as pd
import pytest

from agni.calibrate import (
    LocalRatioModel,
    LogLogRegression,
    QuantileMapper,
    RatioModel,
    StratifiedModel,
    make_model,
)
from agni.validate import apply_bands, loyo, metrics, relative_bands, score

rng = np.random.default_rng(42)


def test_quantile_mapping_recovers_a_monotone_transform():
    m = rng.poisson(6, 20_000).astype(float)
    v = 5 * m  # known truth
    qm = QuantileMapper().fit(m, v)
    for x in (0, 1, 3, 6, 12):
        assert qm.predict(np.array([x]))[0] == pytest.approx(5 * x, rel=1e-9)


def test_quantile_mapping_is_monotone_and_preserves_the_training_total():
    m = rng.poisson(2, 5_000).astype(float)
    v = rng.poisson(3 * m + 1).astype(float)  # noisy, and VIIRS sees fires where MODIS sees none
    qm = QuantileMapper().fit(m, v)
    grid = np.arange(0, 20, 0.5)
    assert np.all(np.diff(qm.predict(grid)) >= 0)
    assert qm.predict(m).sum() == pytest.approx(v.sum(), rel=1e-9)
    # m = 0 maps to the mean of the lowest-ranked VIIRS values, > 0 (small-fire term).
    assert qm.predict(np.array([0.0]))[0] > 0


def test_quantile_mapping_extrapolates_with_the_top_ratio():
    qm = QuantileMapper().fit(np.array([0, 1, 2, 4.0]), np.array([0, 5, 10, 20.0]))
    assert qm.predict(np.array([8.0]))[0] == pytest.approx(40.0)


def test_loglog_recovers_a_power_law_and_ratio_is_sum_preserving():
    m = rng.uniform(0, 50, 2_000)
    v = np.expm1(0.4 + 0.9 * np.log1p(m))
    ll = LogLogRegression().fit(m, v)
    assert (ll.a, ll.b, ll.smear) == pytest.approx((0.4, 0.9, 1.0), abs=1e-6)
    r = RatioModel().fit(np.array([1, 2, 3.0]), np.array([4, 10, 16.0]))
    assert r.k == pytest.approx(5.0)


def _frame(tiles, seasons, m, v, zone=1):
    return pd.DataFrame({"tile": tiles, "season": seasons, "zone": zone, "m": m, "v": v})


def test_local_ratio_learns_each_tiles_ratio_and_shrinks_small_tiles():
    n = 4_000
    hills = _frame([22092] * n, ["dry"] * n, np.full(n, 10.0), np.full(n, 30.0))  # ratio 3
    plains = _frame([22088] * n, ["dry"] * n, np.full(n, 10.0), np.full(n, 80.0))  # ratio 8
    tiny = _frame([25090], ["dry"], [1.0], [20.0])  # one pair with ratio 20
    model = LocalRatioModel(prior=100).fit(pd.concat([hills, plains, tiny], ignore_index=True))
    assert model.k_tile[(22092, "dry")] == pytest.approx(3.0, rel=0.01)
    assert model.k_tile[(22088, "dry")] == pytest.approx(8.0, rel=0.01)
    k_tiny = model.k_tile[(25090, "dry")]
    assert model.k_season["dry"] < k_tiny < 20  # pulled toward the seasonal ratio
    unseen = _frame([99999], ["dry"], [2.0], [0.0])
    assert model.predict(unseen)[0] == pytest.approx(2 * model.k_season["dry"])


def test_stratified_model_falls_back_to_pooled_for_small_strata():
    big = _frame([1] * 100, ["dry"] * 100, np.ones(100), np.full(100, 4.0))
    small = _frame([1] * 3, ["wet"] * 3, np.ones(3), np.full(3, 100.0), zone=2)
    model = StratifiedModel("ratio").fit(pd.concat([big, small], ignore_index=True))
    assert (1, "dry") in model.models and (2, "wet") not in model.models
    assert model.predict(small)[0] == pytest.approx(model.pooled.k)


def test_loyo_never_trains_on_the_held_out_year():
    years = np.repeat(np.arange(2012, 2018), 200)
    pairs = _frame(np.full(len(years), 22092), ["dry"] * len(years), rng.poisson(5, len(years)), 0)
    pairs["v"] = pairs["m"] * 5.0
    pairs["year"] = years
    seen = []

    def check(year, train):
        assert year not in set(train["year"])
        seen.append(year)

    cv = loyo(pairs, "ratio", on_fold=check)
    assert seen == list(range(2012, 2018))
    assert cv["pred"].notna().all()
    assert cv["pred"].to_numpy() == pytest.approx(pairs["v"].to_numpy())


def test_metrics_against_hand_values():
    r = metrics(np.array([1.0, 2, 3, 4]), np.array([1.0, 2, 3, 6]))
    assert r["mae"] == 0.5
    assert r["nmae"] == 0.2  # 0.5 / mean 2.5
    assert r["bias_pct"] == 20.0  # (12 - 10) / 10
    assert r["r2"] == pytest.approx(1 - 4 / 5)


def test_score_reports_every_level():
    df = pd.DataFrame(
        {
            "tile": [1, 1, 2, 2],
            "zone": [1, 1, 1, 1],
            "month": pd.to_datetime(["2015-01-01"] * 2 + ["2015-02-01"] * 2),
            "obs": [1.0, 2, 3, 4],
            "pred": [1.0, 2, 3, 4],
        }
    )
    s = score(df)
    assert set(s) == {"cell", "tile", "zone", "region"}
    assert s["tile"]["mae"] == 0


def test_relative_bands_contain_one_and_scale_area_totals():
    months = pd.date_range("2013-01-01", periods=120, freq="MS")
    tiles = [22092, 22093, 23092]
    rows = []
    for t in tiles:
        for mth in months:
            pred = 200.0
            rows.append(
                {
                    "tile": t,
                    "month": mth,
                    "season": "dry",
                    "pred": pred,
                    "obs": pred * rng.uniform(0.8, 1.3),
                }
            )
    df = pd.DataFrame(rows)
    bands = relative_bands(df)
    assert (bands["r_lo"] <= 1).all() and (bands["r_hi"] >= 1).all()
    lo, hi = apply_bands(df, df["pred"].to_numpy(), bands)
    assert (lo <= df["pred"]).all() and (hi >= df["pred"]).all()
    assert 0.8 <= lo.sum() / df["pred"].sum() <= 0.9
    assert 1.2 <= hi.sum() / df["pred"].sum() <= 1.3


def test_make_model_kinds():
    assert make_model("local_ratio").kind == "local_ratio"
    assert make_model("quantile_mapping").kind == "quantile_mapping"
