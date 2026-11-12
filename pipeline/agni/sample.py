"""Cut the small committed sample (data/sample) out of the full FIRMS download.

Keeps the original FIRMS columns and text formatting, so the sample goes through exactly the
same ingest code as the real data. Boxes: a slice of the Chittagong Hill Tracts (jhum burning)
and of the Sundarbans (rare fires), over the full record, all sensors, archive + NRT.
"""

import gzip
from pathlib import Path

import pandas as pd

from agni.ingest import find_firms_files

# (name, west, south, east, north)
BOXES = [
    ("cht", 92.0, 22.5, 92.5, 23.0),
    ("sundarbans", 89.0, 21.8, 89.5, 22.3),
]


def cut_sample(raw_dir: Path | str, out_dir: Path | str) -> list[tuple[str, int]]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for path in find_firms_files(raw_dir):
        df = pd.read_csv(path, dtype=str, keep_default_na=False)
        lat = df["latitude"].astype(float)
        lon = df["longitude"].astype(float)
        keep = pd.Series(False, index=df.index)
        for _, w, s, e, n in BOXES:
            keep |= lat.between(s, n) & lon.between(w, e)
        name = path.name.replace(".csv.gz", "").replace(".csv", "")
        # Strip the request id (e.g. fire_archive_M-C61_843405 → fire_archive_M-C61_sample).
        stem = name.rsplit("_", 1)[0] + "_sample"
        target = out / f"{stem}.csv.gz"
        text = df[keep].to_csv(index=False, lineterminator="\n")
        with gzip.GzipFile(target, mode="wb", mtime=0, compresslevel=9) as gz:
            gz.write(text.encode("utf-8"))
        written.append((target.name, int(keep.sum())))
    return written
