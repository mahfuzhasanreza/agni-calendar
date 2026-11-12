# Sample data (committed, used by tests and CI)

Real NASA FIRMS rows, unchanged (original columns and formatting), cut from the full archive
download by `uv run --project pipeline python -m agni sample`.

| Box | West | South | East | North | Why |
|---|---|---|---|---|---|
| Chittagong Hill Tracts slice | 92.0 | 22.5 | 92.5 | 23.0 | jhum burning season, dense fires |
| Sundarbans slice | 89.0 | 21.8 | 89.5 | 22.3 | protected mangrove, rare fires |

Coverage: full record (MODIS from 2000-11, VIIRS S-NPP from 2012-01, NOAA-20 from 2018-04),
archive + NRT files, including `type=2` and low-confidence rows so the cleaning rules are
exercised. About 30,000 rows, ~530 KB gzipped.

| File | Product |
|---|---|
| `fire_archive_M-C61_sample.csv.gz` / `fire_nrt_M-C61_sample.csv.gz` | MODIS Collection 6.1 (Terra + Aqua) |
| `fire_archive_SV-C2_sample.csv.gz` / `fire_nrt_SV-C2_sample.csv.gz` | VIIRS 375 m S-NPP, Collection 2 |
| `fire_archive_J1V-C2_sample.csv.gz` / `fire_nrt_J1V-C2_sample.csv.gz` | VIIRS 375 m NOAA-20, Collection 2 |

**Citation.** NASA FIRMS: MODIS Collection 6.1 and VIIRS 375 m Collection 2 active fire
products, distributed by LANCE FIRMS, https://firms.modaps.eosdis.nasa.gov/.
