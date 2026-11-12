# Agni harmonization method (model v1)

> 25 years of fire history, one consistent calendar.
> All numbers below come from the full download for lon 86–97°E, lat 20–28°N
> (5.94 M vegetation-fire detections, Nov 2000 – 11 Nov 2026) and are reproduced by
> `uv run --project pipeline python -m agni all`.

## The problem in one sentence

MODIS (1 km pixels, 2000→) and VIIRS (375 m, 2012→) count fires differently: over the same
months VIIRS S-NPP reports **5.0× more detections** than MODIS Terra + Aqua, so a naive
2000→today record shows a fake "fire explosion" in 2012 (×4.3 region-wide).

## The 60-second version

1. **Clean**: vegetation fires only (FIRMS `type` 0); MODIS confidence ≥ 30, VIIRS nominal/high.
2. **Grid**: count detections per 0.1° cell per month.
3. **Choose consistent references**: MODIS = Terra + Aqua; VIIRS = S-NPP (NOAA-20 only to
   continue it).
4. **Calibrate on the 14 overlap years (Feb 2012 – Dec 2025)**: learn how many VIIRS detections
   correspond to one MODIS detection **in each 1° tile and season**, because that ratio depends
   on the kind of fire: ~3 in the jhum hills, 6–8 in agricultural plains.
5. **Validate honestly**: leave one year out, predict it, repeat for every year; score the
   held-out predictions at the scale users look at.
6. **Publish one series in VIIRS-equivalent units**, with uncertainty bands on every estimated month.

## 1 · Cleaning and gridding

| Rule | Why |
|---|---|
| Keep `type = 0` (archive); drop volcanoes, static industrial sources (kilns, flares), offshore | Only vegetation fire is analysed |
| NRT rows (no `type`): drop points within ~0.5 km of a location the archive marks as `type = 2` | Same rule for provisional data |
| MODIS confidence ≥ 30; VIIRS confidence n or h | FIRMS guidance: below these, false alarms dominate |
| Grid 0.1° (8,800 cells; 7,434 ever burned), monthly, UTC dates | Fine enough for districts, coarse enough for stable counts |
| Store every month of every ever-burned cell, zeros included | A month MODIS saw as 0 is not 0 in VIIRS units |

## 2 · Sensor eras

| Months | Source | Flag |
|---|---|---|
| Nov 2000 – Jun 2002 | Terra only, scaled to Terra + Aqua (local ratio), then calibrated | `terra_only_calibrated` |
| Jul 2002 – Jan 2012 | MODIS Terra + Aqua, calibrated | `calibrated` |
| Feb 2012 – Oct 2026 | VIIRS S-NPP observed (NRT files for Aug–Oct 2026) | `observed` / `observed_nrt` |
| Nov 2026 → | VIIRS NOAA-20, calibrated onto S-NPP | `n20_calibrated` |

*S-NPP data end on 1 Nov 2026.* The last full S-NPP month (Oct 2026) and any region-wide S-NPP
outage are found from the data (S-NPP < ½ NOAA-20 in a month with ≥ 200 NOAA-20 detections);
none were found in 2018–2026. NOAA-20 ≈ S-NPP (ratio 0.98–1.03 per year), and the NOAA-20 → S-NPP
calibration validates at R² 0.992 on held-out tile-months.

## 3 · Calibration models

All fitted per stratum, using cell-month pairs (MODIS value *m*, S-NPP value *v*) from the
overlap years.

| Model | Rule | Notes |
|---|---|---|
| **local ratio** (selected) | v = k_tile,season · m, with k = (ΣV + α·k_season) / (ΣM + α), α = 100 | Ratio learned in each 1° tile and season; tiles with little data are pulled toward the regional seasonal ratio |
| ratio | v = k · m per activity zone × season | Sum-preserving regional baseline |
| quantile mapping | each MODIS value's rank block → mean of the VIIRS values at those ranks | Monotone; maps 0 to the small fires MODIS misses; preserves totals |
| log-log regression | log(1+v) = a + b·log(1+m), Duan smearing | Classic baseline from the literature |

Activity zones = quartiles of a cell's mean annual MODIS detections (2003–2025): MODIS only, so
the VIIRS target never leaks into the strata.

## 4 · Validation (leave-one-year-out)

For each overlap year, every model is refitted without that year and predicts it. Held-out
predictions are scored at four levels: single cells, **1° tile-month totals (~100 cells, the size
of a typical user area; used for model selection)**, activity-zone totals and region totals.

**Detections, held-out, 1° tile-month totals**

| Model | R² | Pearson r | nMAE | Bias |
|---|---|---|---|---|
| **local ratio** | **0.952** | 0.978 | **21.0 %** | −0.2 % |
| quantile mapping | 0.875 | 0.936 | 35.6 % | +0.15 % |
| ratio (zones) | 0.869 | 0.935 | 34.6 % | +0.05 % |
| log-log | 0.571 | 0.900 | 53.4 % | +27.5 % |

Same models, region-month totals: R² 0.984 / 0.986 / 0.987 / 0.860.

| Other checks (held-out) | Level | R² | nMAE | Bias |
|---|---|---|---|---|
| Terra-only path (as if Aqua did not exist) | tile-month | 0.809 | 39.6 % | +3.9 % |
| NOAA-20 → S-NPP | tile-month | 0.992 | 9.6 % | 0.0 % |
| Fire-days, local ratio | tile-month | 0.927 | 26.4 % | −0.8 % |

**What we learned while validating (and why the selection level matters).** Our first candidate
(a ratio per activity zone) scored R² 0.984 on zone totals, which looked excellent. Scored on 1°
tile totals it dropped to 0.869, and for the Chittagong Hill Tracts it overestimated the pre-2012
record by ~30 % (e.g. 2009: 31,441 vs 24,455). The reason: the VIIRS/MODIS ratio ranges from **2.7 to 26** across tiles (median
5.4): jhum hills ≈ 3 (large burns MODIS already sees), agricultural plains 6–8 (many small fires only
VIIRS resolves). Activity zones mix both regimes, and zone totals average the errors away. We
therefore select models on tile-month totals and added the local-ratio model. The local ratio is the only
model whose harmonized 2009–11 → 2012–14 change matches the MODIS-only change (which has no
sensor switch) in every test area:

| Area | MODIS-only | Raw (naive) | Harmonized |
|---|---|---|---|
| Whole region | ×0.89 | ×4.28 | **×0.89** |
| Chittagong Hill Tracts | ×0.89 | ×3.05 | **×0.88** |
| Mizoram | ×0.76 | ×2.74 | **×0.73** |
| Sundarbans | ×1.20 | ×36.4 | ×2.57 (see limitations) |

**The result that matters for users:** in the Chittagong Hill Tracts the raw record shows a
significant *increase* of +442 hotspots/year (Sen's slope, Mann–Kendall p = 0.0004, 2001–2025);
the harmonized record shows a significant *decrease* of −460 hotspots/year (p = 0.0035).

## 5 · Uncertainty bands

Bands are calibrated at the scale users see: for held-out 1° tile-month totals we take the P10 and
P90 of observed ÷ predicted, per season and size of the predicted total, and apply them to each
estimated cell-month. Summed over an area they give the area's P10–P90 range. Examples
(detections, dry season): predicted tile totals > 1,000 → ×0.75–1.28; 100–1,000 → ×0.61–1.48;
10–100 → ×0.42–2.42. Terra-only months use their own, wider bands (> 1,000 → ×0.57–1.40).
Observed months have no band. Bins with fewer than 30 held-out samples use both seasons pooled.

## 6 · Anomalies and trends

Per calendar month, over the baseline years (default 2003–2022, all in VIIRS-equivalent units):
median, P10, P25, P75, P90. The selected month (default: latest complete month) gets its value,
percentile rank (mid-rank), ratio to the median and robust z-score, and a label:
`< P25` below normal · `P25–P75` normal · `P75–P90` above normal · `> P90` extreme. The selected
year is excluded from its own baseline. Annual trends use Sen's slope with the Mann–Kendall test
over complete years.

## 7 · Limitations

- **Fires below MODIS's detection limit cannot be recovered.** Where MODIS saw almost nothing (e.g.
  the Sundarbans), a residual 2012 step remains (×2.6 instead of ×36). For such rare-fire areas,
  compare against the VIIRS era (2012→) only.
- A cell with no MODIS detection in a month gets 0 before 2012 (ratio models); VIIRS-only small
  fires are recovered on average through the local ratio, not cell by cell. Single 0.1° cells are
  much less certain (held-out nMAE 64 %) than area totals.
- MODIS orbital drift: the yearly VIIRS/MODIS ratio stays within 4.9–5.4 for 2013–2025 with no trend,
  so the whole overlap is used; this should be re-checked as Terra/Aqua drift further.
- Partial S-NPP outages within a month are not detected (only region-wide outages).
- Preset areas are approximate boxes. Dates are UTC.

## Data

NASA FIRMS: MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m Collection 2 (S-NPP, NOAA-20),
standard archive + NRT, downloaded 2026-11-12. Code: `pipeline/agni/` (calibrate.py, validate.py,
harmonize.py); tests: `pipeline/tests/`.
