"""Command line: python -m agni {build,calibrate,load,all,sample}.

build      raw FIRMS CSVs → data/interim/*.parquet + detection tiles
calibrate  MODIS → VIIRS harmonization with leave-one-year-out validation (model v1)
load       data/interim → Postgres (DIRECT_URL, or --database-url); uses v1 if calibrated
all        build + calibrate + load
sample     cut data/sample from data/raw
"""

import argparse
import json
import os
import time
from pathlib import Path

import pandas as pd

from agni import aggregate, clean, grid, harmonize, ingest, naive, tiles
from agni.config import DEFAULT

REPO = Path(__file__).resolve().parents[2]


def _log(msg: str, t0: float) -> None:
    print(f"[{time.perf_counter() - t0:7.1f}s] {msg}", flush=True)


def build(raw: Path, interim: Path, tiles_dir: Path, dataset_version: str) -> dict:
    t0 = time.perf_counter()
    interim.mkdir(parents=True, exist_ok=True)

    raw_df = ingest.read_all(raw)
    _log(f"read {len(raw_df):,} rows from {raw}", t0)
    rows_in = len(raw_df)
    det = clean.clean(raw_df, DEFAULT)
    del raw_df  # free memory before aggregation (full region ≈ 6.6 M rows)
    _log(
        f"clean: {len(det):,} vegetation-fire detections "
        f"({int(det['qualified'].sum()):,} qualified)",
        t0,
    )
    det.to_parquet(interim / "detections.parquet", index=False)

    obs = aggregate.monthly_obs(det, DEFAULT)
    cm = naive.naive_stitch(obs, det, DEFAULT)
    cm.to_parquet(interim / "cell_month.parquet", index=False)
    _log(f"aggregate: {cm['cell_id'].nunique():,} ever-active cells, {len(cm):,} cell-months", t0)

    cells = grid.cells_frame(DEFAULT)
    cells["ever_active"] = cells["id"].isin(set(cm["cell_id"]))
    cells.to_parquet(interim / "cells.parquet", index=False)

    manifest = tiles.write_tiles(det, tiles_dir, dataset_version, DEFAULT)
    _log(
        f"tiles: {len(manifest['tiles'])} files, {manifest['total_rows']:,} rows → {tiles_dir}", t0
    )

    meta = {
        "rows_in": rows_in,
        "rows_clean": len(det),
        "rows_qualified": int(det["qualified"].sum()),
        "date_min": det["acq_date"].min().strftime("%Y-%m-%d"),
        "date_max": det["acq_date"].max().strftime("%Y-%m-%d"),
        "per_sensor": {
            str(k): int(v) for k, v in det["sensor"].value_counts().sort_index().items() if v
        },
        "dataset_version": dataset_version,
        # Months whose VIIRS data come from near-real-time files (provisional).
        "nrt_months": sorted(
            det.loc[
                (det["source"] == "nrt") & det["sensor"].isin(["VIIRS_SNPP", "VIIRS_N20"]),
                "acq_date",
            ]
            .dt.strftime("%Y-%m")
            .unique()
            .tolist()
        ),
    }
    (interim / "build.json").write_text(json.dumps(meta, indent=1) + "\n")
    # Any previous calibration belongs to the previous build.
    (interim / "model_v1.json").unlink(missing_ok=True)
    return meta


def calibrate(interim: Path) -> dict:
    t0 = time.perf_counter()
    meta = json.loads((interim / "build.json").read_text())
    obs = pd.read_parquet(interim / "cell_month.parquet")
    nrt = {pd.Timestamp(m + "-01") for m in meta.get("nrt_months", [])}
    cm, model_run, rows, zone_rows, zone = harmonize.run(obs, nrt, DEFAULT)
    cm.to_parquet(interim / "cell_month_v1.parquet", index=False)
    zone.rename("zone_id").reset_index().rename(columns={"index": "cell_id"}).to_parquet(
        interim / "cell_zones.parquet", index=False
    )
    (interim / "model_v1.json").write_text(
        json.dumps({"model_run": model_run, "calibration_rows": rows, "zones": zone_rows}) + "\n"
    )
    r = model_run["metrics"]
    best = r["chosen"][r["headline_metric"]]
    tile_score = r["by_metric"][r["headline_metric"]]["models"][best]["tile"]
    _log(
        f"calibrated: headline={r['headline_metric']} model={best} tile-month {tile_score}; "
        f"S-NPP last full month {r['snpp_last_full_month']}, outages {r['snpp_outage_months']}",
        t0,
    )
    return r


def load(interim: Path, database_url: str, kind: str) -> dict:
    from agni.load import load_all  # psycopg only needed here

    t0 = time.perf_counter()
    meta = json.loads((interim / "build.json").read_text())
    cells = pd.read_parquet(interim / "cells.parquet")
    if (interim / "model_v1.json").exists():
        model = json.loads((interim / "model_v1.json").read_text())
        cm = pd.read_parquet(interim / "cell_month_v1.parquet")
        zones = pd.read_parquet(interim / "cell_zones.parquet").set_index("cell_id")["zone_id"]
        cells = cells.assign(zone_id=cells["id"].map(zones))
        summary = load_all(
            database_url,
            cells,
            cm,
            model["model_run"],
            kind,
            meta["rows_in"],
            meta["date_min"],
            meta["date_max"],
            zones=model["zones"],
            calibration_rows=model["calibration_rows"],
            cfg=DEFAULT,
        )
        _log(f"loaded {summary}", t0)
        return summary

    cm = pd.read_parquet(interim / "cell_month.parquet")
    model_run = {
        "model_version": naive.MODEL_VERSION,
        "metric": "detections",
        "method": "naive_stitch",
        "grid_res": DEFAULT.grid_res,
        "calib_from": 0,
        "calib_to": 0,
        "metrics": {},
        "cv_predictions": {},
        "notes": "Placeholder: raw sensors stitched without calibration (shows the 2012 jump).",
    }
    summary = load_all(
        database_url,
        cells,
        cm,
        model_run,
        kind,
        meta["rows_in"],
        meta["date_min"],
        meta["date_max"],
        cfg=DEFAULT,
    )
    _log(f"loaded {summary}", t0)
    return summary


def _database_url(arg: str | None) -> str:
    url = arg or os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("no database URL: pass --database-url or set DIRECT_URL")
    return url


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="agni", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_build_args(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--raw", type=Path, default=REPO / "data" / "raw")
        sp.add_argument("--interim", type=Path, default=REPO / "data" / "interim")
        sp.add_argument("--tiles", type=Path, default=REPO / "data" / "tiles")
        sp.add_argument("--dataset-version", default="data-v1")

    add_build_args(sub.add_parser("build", help="raw CSVs → parquet + tiles"))
    sp_cal = sub.add_parser("calibrate", help="harmonize + validate (model v1)")
    sp_cal.add_argument("--interim", type=Path, default=REPO / "data" / "interim")
    sp_load = sub.add_parser("load", help="parquet → Postgres")
    sp_load.add_argument("--interim", type=Path, default=REPO / "data" / "interim")
    sp_all = sub.add_parser("all", help="build + calibrate + load")
    add_build_args(sp_all)
    for sp in (sp_load, sp_all):
        sp.add_argument("--database-url", default=None)
        sp.add_argument("--kind", default="archive", choices=["archive", "sample", "nrt"])
    sp_sample = sub.add_parser("sample", help="cut data/sample from data/raw")
    sp_sample.add_argument("--raw", type=Path, default=REPO / "data" / "raw")
    sp_sample.add_argument("--out", type=Path, default=REPO / "data" / "sample")

    a = p.parse_args(argv)
    if a.cmd == "build":
        print(json.dumps(build(a.raw, a.interim, a.tiles, a.dataset_version), indent=1))
    elif a.cmd == "calibrate":
        calibrate(a.interim)
    elif a.cmd == "load":
        load(a.interim, _database_url(a.database_url), a.kind)
    elif a.cmd == "all":
        build(a.raw, a.interim, a.tiles, a.dataset_version)
        calibrate(a.interim)
        load(a.interim, _database_url(a.database_url), a.kind)
    elif a.cmd == "sample":
        from agni.sample import cut_sample

        for name, n in cut_sample(a.raw, a.out):
            print(f"{name}: {n:,} rows")
    return 0
