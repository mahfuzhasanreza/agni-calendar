import pandas as pd

from agni import clean, ingest
from tests.conftest import firms_row


def _clean(write_csv, archive_rows, nrt_rows=()):
    write_csv("fire_archive_a.csv", list(archive_rows))
    if nrt_rows:
        write_csv("fire_nrt_a.csv", list(nrt_rows), nrt=True)
    raw_dir = write_csv("x.csv", []).parent
    (raw_dir / "x.csv").unlink()
    return clean.clean(ingest.read_all(raw_dir))


def test_keeps_only_vegetation_fires_from_archive(write_csv):
    out = _clean(
        write_csv,
        [
            firms_row(22.5, 92.1, "2010-03-01", type_=0),
            firms_row(22.5, 92.2, "2010-03-01", type_=1),  # volcano
            firms_row(22.5, 92.3, "2010-03-01", type_=2),  # static industrial
            firms_row(22.5, 92.4, "2010-03-01", type_=3),  # offshore
        ],
    )
    assert out["lon"].tolist() == [92.1]


def test_confidence_classes_and_qualified_flag(write_csv):
    out = _clean(
        write_csv,
        [
            firms_row(22.5, 92.1, "2015-03-01", "Aqua", "29"),
            firms_row(22.5, 92.1, "2015-03-02", "Aqua", "30"),
            firms_row(22.5, 92.1, "2015-03-03", "Aqua", "80"),
            firms_row(22.5, 92.1, "2015-03-04", "SNPP", "l"),
            firms_row(22.5, 92.1, "2015-03-05", "SNPP", "n"),
            firms_row(22.5, 92.1, "2015-03-06", "SNPP", "h"),
        ],
    )
    assert out["conf_class"].tolist() == ["low", "nominal", "high", "low", "nominal", "high"]
    assert out["qualified"].tolist() == [False, True, True, False, True, True]


def test_points_outside_region_are_dropped(write_csv):
    out = _clean(
        write_csv, [firms_row(22.5, 92.1, "2015-03-01"), firms_row(30.0, 92.1, "2015-03-01")]
    )
    assert len(out) == 1


def test_nrt_rows_covered_by_archive_are_dropped(write_csv):
    out = _clean(
        write_csv,
        [firms_row(22.5, 92.1, "2026-07-31", "SNPP", "n")],
        [
            firms_row(22.6, 92.1, "2026-07-31", "SNPP", "n", None),  # same day as archive: drop
            firms_row(22.7, 92.1, "2026-08-01", "SNPP", "n", None),  # after archive: keep
        ],
    )
    assert out["lat"].tolist() == [22.5, 22.7]
    assert out["source"].tolist() == ["archive", "nrt"]


def test_nrt_points_on_known_static_sources_are_dropped(write_csv):
    out = _clean(
        write_csv,
        [firms_row(23.70, 90.40, "2020-01-01", type_=2)],  # brick kiln known from the archive
        [
            firms_row(23.7012, 90.4009, "2026-10-01", "N20", "n", None),  # ~150 m away: drop
            firms_row(23.80, 90.40, "2026-10-01", "N20", "n", None),  # 11 km away: keep
        ],
    )
    assert out["lat"].tolist() == [23.80]


def test_cell_ids_assigned(write_csv):
    out = _clean(write_csv, [firms_row(22.65, 92.25, "2015-03-01")])
    assert out["cell_id"].iloc[0] == 260062
    assert pd.api.types.is_integer_dtype(out["cell_id"])
