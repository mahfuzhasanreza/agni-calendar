"""Monthly aggregation per cell (CLAUDE.md §5.2).

Output is DENSE: every ever-active cell × every month from cfg.first_month to the last month
with data, zeros included (a harmonized MODIS=0 month is not 0, so missing ≠ zero; PLAN §1b).
Only `qualified` detections are counted.
"""

import pandas as pd

from agni.config import DEFAULT, Config

DET_COLUMNS = {
    "MODIS_T": "det_modis_t",
    "MODIS_A": "det_modis_a",
    "VIIRS_SNPP": "det_viirs_snpp",
    "VIIRS_N20": "det_viirs_n20",
}
SMALLINT_MAX = 32_767


def month_start(dates: pd.Series) -> pd.Series:
    return dates.dt.to_period("M").dt.to_timestamp()


def monthly_obs(det: pd.DataFrame, cfg: Config = DEFAULT) -> pd.DataFrame:
    """Dense cell × month table with per-sensor detection counts and fire-days.

    Columns: cell_id, month, det_modis_t, det_modis_a, det_viirs_snpp, det_viirs_n20,
    fd_modis (distinct days Terra ∪ Aqua), fd_viirs_snpp, fd_viirs_n20.
    """
    keep = det["qualified"].to_numpy() & det["sensor"].isin(list(DET_COLUMNS)).to_numpy()
    q = det.loc[keep, ["cell_id", "acq_date", "sensor"]].copy()
    q["month"] = month_start(q["acq_date"])

    counts = (
        q.groupby(["cell_id", "month", "sensor"], observed=True)
        .size()
        .unstack("sensor", fill_value=0)
        .rename(columns=str)
        .reindex(columns=list(DET_COLUMNS), fill_value=0)
    )
    counts.columns = [DET_COLUMNS[c] for c in counts.columns]

    # Fire-days: distinct days with ≥1 detection. MODIS = Terra ∪ Aqua (same day counts once).
    families = {
        "fd_modis": ["MODIS_T", "MODIS_A"],
        "fd_viirs_snpp": ["VIIRS_SNPP"],
        "fd_viirs_n20": ["VIIRS_N20"],
    }
    fire_days = pd.concat(
        {
            name: q.loc[q["sensor"].isin(members)]
            .groupby(["cell_id", "month"])["acq_date"]
            .nunique()
            for name, members in families.items()
        },
        axis=1,
    ).reindex(columns=list(families))
    sparse = counts.join(fire_days, how="outer").fillna(0)

    # Dense index: ever-active cells × all months.
    cells = sorted(q["cell_id"].unique())
    last = q["month"].max() if len(q) else pd.Timestamp(cfg.first_month + "-01")
    months = pd.date_range(pd.Timestamp(cfg.first_month + "-01"), last, freq="MS")
    full = pd.MultiIndex.from_product([cells, months], names=["cell_id", "month"])
    dense = sparse.reindex(full, fill_value=0).astype("int32").reset_index()

    over = dense[list(DET_COLUMNS.values())].max().max() if len(dense) else 0
    if over > SMALLINT_MAX:
        raise ValueError(f"a cell-month count ({over}) exceeds SMALLINT; use a coarser grid")
    return dense
