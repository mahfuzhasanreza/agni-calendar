"""Placeholder series `raw-v0`: naive sensor stitching, NOT harmonized.

Used until the calibrated model (M6) exists, so the app works end to end on real data.
It deliberately shows the fake jump at 2012 (the problem Agni solves):
  before the first full S-NPP month → MODIS Terra + Aqua (raw)
  S-NPP months                      → VIIRS S-NPP (raw)
  after the last S-NPP month        → VIIRS NOAA-20 (raw)
"""

import pandas as pd

from agni.config import DEFAULT, Config

MODEL_VERSION = "raw-v0"


def naive_stitch(obs: pd.DataFrame, det: pd.DataFrame, cfg: Config = DEFAULT) -> pd.DataFrame:
    """Add modis_ref, harm, harm_lo, harm_hi and source_flag to the dense monthly table."""
    snpp = det.loc[det["sensor"] == "VIIRS_SNPP", "acq_date"]
    first_snpp = pd.Timestamp(cfg.snpp_first_full_month + "-01")
    last_snpp = snpp.max().to_period("M").to_timestamp() if len(snpp) else first_snpp

    out = obs.copy()
    out["modis_ref"] = (out["det_modis_t"] + out["det_modis_a"]).astype("float32")
    m = out["month"]
    harm = out["modis_ref"].where(m < first_snpp, out["det_viirs_snpp"])
    harm = harm.where(m <= last_snpp, out["det_viirs_n20"])
    out["harm"] = harm.astype("float32")
    out["harm_lo"] = out["harm"]
    out["harm_hi"] = out["harm"]
    out["source_flag"] = "observed"
    return out
