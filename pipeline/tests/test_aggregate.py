import pandas as pd

from agni import aggregate, naive


def test_counts_per_sensor_and_fire_days_union(det_frame):
    det = det_frame(
        [
            # Same day seen by Terra and Aqua: 2 detections but 1 MODIS fire-day.
            {"lat": 22.65, "lon": 92.25, "acq_date": "2010-03-05", "sensor": "MODIS_T"},
            {"lat": 22.65, "lon": 92.25, "acq_date": "2010-03-05", "sensor": "MODIS_A"},
            {"lat": 22.66, "lon": 92.26, "acq_date": "2010-03-09", "sensor": "MODIS_A"},
            # Unqualified detection: not counted.
            {
                "lat": 22.65,
                "lon": 92.25,
                "acq_date": "2010-03-10",
                "sensor": "MODIS_A",
                "qualified": False,
            },
        ]
    )
    obs = aggregate.monthly_obs(det)
    row = obs[(obs["cell_id"] == 260062) & (obs["month"] == "2010-03-01")].iloc[0]
    assert (row["det_modis_t"], row["det_modis_a"]) == (1, 2)
    assert row["fd_modis"] == 2  # 5th and 9th


def test_output_is_dense_with_zero_months(det_frame):
    det = det_frame(
        [
            {"lat": 22.65, "lon": 92.25, "acq_date": "2001-01-15", "sensor": "MODIS_T"},
            {"lat": 24.05, "lon": 90.05, "acq_date": "2001-03-15", "sensor": "MODIS_T"},
        ]
    )
    obs = aggregate.monthly_obs(det)
    # 2 ever-active cells × 5 months (2000-11 .. 2001-03)
    assert len(obs) == 2 * 5
    assert obs["month"].min() == pd.Timestamp("2000-11-01")
    assert int(obs[["det_modis_t", "det_modis_a"]].to_numpy().sum()) == 2


def test_naive_stitch_switches_sensor_at_snpp_and_after_its_end(det_frame):
    rows = []
    for month, sensor, n in [
        ("2011-06-10", "MODIS_A", 3),
        ("2012-06-10", "MODIS_A", 3),
        ("2012-06-11", "VIIRS_SNPP", 10),
        ("2026-10-11", "VIIRS_SNPP", 7),
        ("2026-12-11", "VIIRS_N20", 9),
    ]:
        rows += [{"lat": 22.65, "lon": 92.25, "acq_date": month, "sensor": sensor}] * n
    det = det_frame(rows)
    out = naive.naive_stitch(aggregate.monthly_obs(det), det).set_index("month")
    assert out.loc["2011-06-01", "harm"] == 3  # MODIS before S-NPP
    assert out.loc["2012-06-01", "harm"] == 10  # S-NPP, not MODIS
    assert out.loc["2026-10-01", "harm"] == 7  # last S-NPP month
    assert out.loc["2026-12-01", "harm"] == 9  # NOAA-20 after S-NPP ended
    assert (out["harm_lo"] == out["harm"]).all()
    assert (out["source_flag"] == "observed").all()
