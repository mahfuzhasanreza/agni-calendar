"""Load pipeline outputs into Postgres (schema owned by Prisma migrations, PLAN §3).

Everything that changes app data happens in ONE transaction: cells, cell_month (active model
only, replaced wholesale), model_run activation. If anything fails, the database is unchanged.
Re-running is idempotent. The ingest_run audit row is written outside that transaction so a
failure is still recorded.
"""

import io
import json
from collections.abc import Iterable

import pandas as pd
import psycopg

from agni.config import DEFAULT, Config

CELL_MONTH_COLUMNS = [
    "cell_id",
    "month",
    "det_modis_t",
    "det_modis_a",
    "det_viirs_snpp",
    "det_viirs_n20",
    "modis_ref",
    "harm",
    "harm_lo",
    "harm_hi",
    "source_flag",
]
CHUNK_ROWS = 200_000


def _csv_chunks(df: pd.DataFrame) -> Iterable[bytes]:
    for start in range(0, len(df), CHUNK_ROWS):
        buf = io.StringIO()
        df.iloc[start : start + CHUNK_ROWS].to_csv(buf, index=False, header=False)
        yield buf.getvalue().encode("utf-8")


def _copy(cur: psycopg.Cursor, table: str, columns: list[str], df: pd.DataFrame) -> None:
    cols = ", ".join(columns)
    with cur.copy(f"COPY {table} ({cols}) FROM STDIN WITH (FORMAT csv)") as copy:
        for chunk in _csv_chunks(df[columns]):
            copy.write(chunk)


def _start_run(conninfo: str, kind: str, rows_in: int) -> int:
    with psycopg.connect(conninfo, autocommit=True) as conn:
        row = conn.execute(
            "INSERT INTO ingest_run (kind, status, rows_in) "
            "VALUES (%s, 'running', %s) RETURNING id",
            (kind, rows_in),
        ).fetchone()
        assert row is not None
        return int(row[0])


def _finish_run(conninfo: str, run_id: int, status: str, **fields: object) -> None:
    sets = ", ".join(f"{k} = %({k})s" for k in fields)
    extra = f", {sets}" if sets else ""
    sql = f"UPDATE ingest_run SET status = %(status)s, finished_at = now(){extra} WHERE id = %(id)s"
    with psycopg.connect(conninfo, autocommit=True) as conn:
        conn.execute(sql, {"status": status, "id": run_id, **fields})


def load_all(
    conninfo: str,
    cells: pd.DataFrame,
    cell_month: pd.DataFrame,
    model_run: dict,
    kind: str,
    rows_in: int,
    data_from: str,
    data_to: str,
    zones: list[dict] | None = None,
    calibration_rows: list[dict] | None = None,
    cfg: Config = DEFAULT,
) -> dict:
    """Replace zones, cells, cell_month and activate model_run (+ its calibration rows).

    `cells` may carry a zone_id column (calibrated models); NULL otherwise.
    """
    run_id = _start_run(conninfo, kind, rows_in)
    try:
        months = pd.to_datetime(cell_month["month"])
        cm = cell_month.assign(month=months.dt.strftime("%Y-%m-%d"))
        if "zone_id" not in cells:
            cells = cells.assign(zone_id=pd.NA)
        cells = cells.assign(zone_id=cells["zone_id"].astype("Int16"))
        with psycopg.connect(conninfo) as conn, conn.cursor() as cur:
            cur.execute(
                """CREATE TEMP TABLE stage_cell (
                     id int, "row" smallint, col smallint, res real,
                     center_lat real, center_lon real, ever_active boolean, zone_id int
                   ) ON COMMIT DROP"""
            )
            _copy(
                cur,
                "stage_cell",
                ["id", "row", "col", "res", "center_lat", "center_lon", "ever_active", "zone_id"],
                cells,
            )
            cur.execute("DELETE FROM cell")
            cur.execute("DELETE FROM zone")
            for z in zones or []:
                cur.execute(
                    "INSERT INTO zone (id, name, description) "
                    "VALUES (%(id)s, %(name)s, %(description)s)",
                    z,
                )
            cur.execute(
                """INSERT INTO cell
                     (id, "row", col, res, center_lat, center_lon, geom, ever_active, zone_id)
                   SELECT id, "row", col, res, center_lat, center_lon,
                          ST_MakeEnvelope(
                            round((%(w)s + col * %(r)s)::numeric, 6)::float8,
                            round((%(s)s + "row" * %(r)s)::numeric, 6)::float8,
                            round((%(w)s + (col + 1) * %(r)s)::numeric, 6)::float8,
                            round((%(s)s + ("row" + 1) * %(r)s)::numeric, 6)::float8,
                            4326),
                          ever_active, zone_id
                   FROM stage_cell""",
                {"w": cfg.west, "s": cfg.south, "r": cfg.grid_res},
            )

            cur.execute("TRUNCATE cell_month")
            _copy(cur, "cell_month", CELL_MONTH_COLUMNS, cm)

            version = model_run["model_version"]
            cur.execute("DELETE FROM model_run WHERE model_version = %s", (version,))
            cur.execute(
                """INSERT INTO model_run (model_version, metric, method, grid_res, calib_from,
                     calib_to, metrics, cv_predictions, is_active, notes)
                   VALUES (%(model_version)s, %(metric)s, %(method)s, %(grid_res)s,
                     %(calib_from)s, %(calib_to)s, %(metrics)s, %(cv_predictions)s, false,
                     %(notes)s)""",
                {
                    **model_run,
                    "metrics": json.dumps(model_run.get("metrics", {})),
                    "cv_predictions": json.dumps(model_run.get("cv_predictions", {})),
                    "notes": model_run.get("notes"),
                },
            )
            for row in calibration_rows or []:
                cur.execute(
                    """INSERT INTO calibration_model
                         (model_version, metric, zone_id, season, method, params, metrics)
                       VALUES (%(model_version)s, %(metric)s, %(zone_id)s, %(season)s, %(method)s,
                         %(params)s, %(metrics)s)""",
                    {
                        **row,
                        "params": json.dumps(row["params"]),
                        "metrics": json.dumps(row.get("metrics", {})),
                    },
                )
            # Exactly one active model.
            cur.execute("UPDATE model_run SET is_active = (model_version = %s)", (version,))
            cur.execute("ANALYZE cell")
            cur.execute("ANALYZE cell_month")
            conn.commit()

        summary = {
            "cells": len(cells),
            "ever_active_cells": int(cells["ever_active"].sum()),
            "cell_month_rows": len(cell_month),
            "model_version": model_run["model_version"],
        }
        _finish_run(
            conninfo,
            run_id,
            "success",
            rows_loaded=len(cell_month),
            data_from=data_from,  # first / last detection date (YYYY-MM-DD)
            data_to=data_to,
            message=json.dumps(summary),
        )
        return summary
    except Exception as exc:
        _finish_run(conninfo, run_id, "failed", message=str(exc)[:1000])
        raise
