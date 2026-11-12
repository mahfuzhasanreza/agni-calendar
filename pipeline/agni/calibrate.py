"""Calibration models: map a source sensor's monthly cell values onto the reference sensor.

Used for MODIS → VIIRS S-NPP (the main harmonization) and VIIRS NOAA-20 → S-NPP (continuity
after S-NPP ends). Three candidates, all fitted per stratum (zone × season):

- QuantileMapper: empirical CDF matching. Counts are discrete, so each source value m occupies
  a block of ranks; its output is the MEAN of the reference values at those ranks. This makes
  the mapping monotone, defines m = 0 (→ the small fires the coarse sensor misses) and preserves
  the training total exactly.
- LogLogRegression: log(1+V) = a + b·log(1+M), back-transformed with Duan's smearing factor.
- RatioModel: V = k·M with k = ΣV/ΣM (sum-preserving baseline, but maps 0 → 0).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

MIN_STRATUM_PAIRS = 50  # smaller strata fall back to the model fitted on all strata


class QuantileMapper:
    kind = "quantile_mapping"

    def fit(self, m: np.ndarray, v: np.ndarray) -> QuantileMapper:
        m = np.asarray(m, dtype="float64")
        v_sorted = np.sort(np.asarray(v, dtype="float64"))
        m_sorted = np.sort(m)
        xs, starts = np.unique(m_sorted, return_index=True)
        ends = np.append(starts[1:], len(m_sorted))
        csum = np.concatenate([[0.0], np.cumsum(v_sorted)])
        ys = (csum[ends] - csum[starts]) / (ends - starts)
        self.xs = xs
        self.ys = np.maximum.accumulate(ys)  # guard monotonicity against float noise
        return self

    def predict(self, m: np.ndarray) -> np.ndarray:
        m = np.asarray(m, dtype="float64")
        out = np.interp(m, self.xs, self.ys)
        top_x, top_y = self.xs[-1], self.ys[-1]
        if top_x > 0:  # beyond the training range: keep the top block's ratio
            above = m > top_x
            out[above] = m[above] * (top_y / top_x)
        return out

    def params(self) -> dict:
        return {"x": self.xs.round(4).tolist(), "y": self.ys.round(4).tolist()}


class LogLogRegression:
    kind = "loglog"

    def fit(self, m: np.ndarray, v: np.ndarray) -> LogLogRegression:
        x = np.log1p(np.asarray(m, dtype="float64"))
        y = np.log1p(np.asarray(v, dtype="float64"))
        if np.ptp(x) == 0:
            self.b, self.a = 0.0, float(y.mean())
        else:
            self.b, self.a = (float(c) for c in np.polyfit(x, y, 1))
        self.smear = float(np.mean(np.exp(y - (self.a + self.b * x))))  # Duan (1983)
        return self

    def predict(self, m: np.ndarray) -> np.ndarray:
        x = np.log1p(np.asarray(m, dtype="float64"))
        return np.maximum(np.exp(self.a + self.b * x) * self.smear - 1.0, 0.0)

    def params(self) -> dict:
        return {"a": round(self.a, 6), "b": round(self.b, 6), "smear": round(self.smear, 6)}


class RatioModel:
    kind = "ratio"

    def fit(self, m: np.ndarray, v: np.ndarray) -> RatioModel:
        sm = float(np.sum(m))
        self.k = float(np.sum(v)) / sm if sm > 0 else 0.0
        return self

    def predict(self, m: np.ndarray) -> np.ndarray:
        return self.k * np.asarray(m, dtype="float64")

    def params(self) -> dict:
        return {"k": round(self.k, 6)}


MODEL_KINDS = {c.kind: c for c in (QuantileMapper, LogLogRegression, RatioModel)}


@dataclass
class StratifiedModel:
    """One model per (zone, season), with a pooled fallback for small strata."""

    kind: str
    models: dict[tuple[int, str], object] = field(default_factory=dict)
    pooled: object | None = None

    def fit(self, df: pd.DataFrame) -> StratifiedModel:
        """df columns: zone, season, m (source), v (reference)."""
        cls = MODEL_KINDS[self.kind]
        self.pooled = cls().fit(df["m"].to_numpy(), df["v"].to_numpy())
        self.models = {}
        for (zone, season), g in df.groupby(["zone", "season"], observed=True):
            if len(g) >= MIN_STRATUM_PAIRS:
                self.models[(int(zone), str(season))] = cls().fit(
                    g["m"].to_numpy(), g["v"].to_numpy()
                )
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        out = np.empty(len(df), dtype="float64")
        zone = df["zone"].to_numpy()
        season = df["season"].to_numpy()
        m = df["m"].to_numpy()
        done = np.zeros(len(df), dtype=bool)
        for (z, s), model in self.models.items():
            sel = (zone == z) & (season == s)
            if sel.any():
                out[sel] = model.predict(m[sel])
                done |= sel
        if (~done).any():
            out[~done] = self.pooled.predict(m[~done])
        return out

    def rows(self, model_version: str, metric: str, season_label: str | None = None) -> list[dict]:
        """Rows for the calibration_model table (one per stratum + the pooled fallback)."""
        rows = [
            {
                "model_version": model_version,
                "metric": metric,
                "zone_id": z,
                "season": f"{season_label}_{s}" if season_label else s,
                "method": self.kind,
                "params": m.params(),
            }
            for (z, s), m in sorted(self.models.items())
        ]
        rows.append(
            {
                "model_version": model_version,
                "metric": metric,
                "zone_id": 0,
                "season": f"{season_label}_pooled" if season_label else "pooled",
                "method": self.kind,
                "params": self.pooled.params(),
            }
        )
        return rows


@dataclass
class LocalRatioModel:
    """V = k·M with a LOCAL ratio k per 1° tile and season.

    The VIIRS/MODIS ratio depends on the fire regime: ~3 in the jhum hills (large burns that
    MODIS already sees) but 6-8 in agricultural plains (many small fires only VIIRS resolves).
    Each tile's ratio is estimated from all overlap years and shrunk toward the seasonal
    regional ratio when the tile has little MODIS signal (empirical-Bayes style):
        k_tile = (ΣV_tile + α·k_season) / (ΣM_tile + α),  α = `prior` MODIS detections.
    Needs columns: tile, season, m, v.
    """

    kind: str = "local_ratio"
    prior: float = 100.0
    k_season: dict[str, float] = field(default_factory=dict)
    k_tile: dict[tuple[int, str], float] = field(default_factory=dict)
    k_pooled: float = 0.0

    def fit(self, df: pd.DataFrame) -> LocalRatioModel:
        sm = float(df["m"].sum())
        self.k_pooled = float(df["v"].sum()) / sm if sm > 0 else 0.0
        by_season = df.groupby("season", observed=True)[["m", "v"]].sum()
        self.k_season = {
            str(s): (float(r.v) / float(r.m) if r.m > 0 else self.k_pooled)
            for s, r in by_season.iterrows()
        }
        by_tile = df.groupby(["tile", "season"], observed=True)[["m", "v"]].sum()
        self.k_tile = {}
        for (tile, season), r in by_tile.iterrows():
            ks = self.k_season.get(str(season), self.k_pooled)
            self.k_tile[(int(tile), str(season))] = (float(r.v) + self.prior * ks) / (
                float(r.m) + self.prior
            )
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        keys = zip(df["tile"].to_numpy(), df["season"].to_numpy(), strict=True)
        k = np.fromiter(
            (
                self.k_tile.get((int(t), str(s)), self.k_season.get(str(s), self.k_pooled))
                for t, s in keys
            ),
            dtype="float64",
            count=len(df),
        )
        return k * df["m"].to_numpy(dtype="float64")

    def rows(self, model_version: str, metric: str, season_label: str | None = None) -> list[dict]:
        """One row per season; params map tile code (south*1000 + west) → ratio."""
        out = []
        for season, ks in sorted(self.k_season.items()):
            tiles = {
                str(t): round(k, 4) for (t, s), k in sorted(self.k_tile.items()) if s == season
            }
            out.append(
                {
                    "model_version": model_version,
                    "metric": metric,
                    "zone_id": 0,
                    "season": f"{season_label}_{season}" if season_label else season,
                    "method": self.kind,
                    "params": {"prior": self.prior, "k_season": round(ks, 4), "k_tile": tiles},
                }
            )
        return out


CANDIDATES = ("quantile_mapping", "loglog", "ratio", "local_ratio")


def make_model(kind: str):
    """Fresh, unfitted model of the given kind (all expose fit(df) / predict(df) / rows())."""
    return LocalRatioModel() if kind == "local_ratio" else StratifiedModel(kind)
