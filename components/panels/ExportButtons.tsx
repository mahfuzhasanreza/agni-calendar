import { Download } from "lucide-react";
import type { Aoi } from "@/lib/contracts";
import { MAX_DETECTION_ROWS } from "@/lib/export";

type Props = { aoi: Aoi; start: string; end: string };

function exportUrl(path: string, { aoi, start, end }: Props): string {
  const p = new URLSearchParams({ aoi: JSON.stringify(aoi), start, end });
  return `${path}?${p.toString()}`;
}

const linkClass =
  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent";

/** CSV downloads for the current area and date range (plain links: the browser streams them). */
export function ExportButtons(props: Props) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1.5">
        <a
          className={linkClass + " self-start"}
          href={exportUrl("/api/export/detections", props)}
          download
        >
          <Download className="size-4" aria-hidden /> Raw detections (CSV)
        </a>
        <p className="text-xs text-muted-foreground">
          Every NASA FIRMS vegetation-fire hotspot inside the area, {props.start} to {props.end}:
          date and time (UTC), position, sensor and satellite, confidence (with{" "}
          <code>qualified</code> = 1 for the detections used in the analysis), fire radiative power
          and brightness. Up to {MAX_DETECTION_ROWS.toLocaleString("en-US")} rows; ordered by 1°
          tile, then date.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <a
          className={linkClass + " self-start"}
          href={exportUrl("/api/export/series", props)}
          download
        >
          <Download className="size-4" aria-hidden /> Monthly harmonized series (CSV)
        </a>
        <p className="text-xs text-muted-foreground">
          One row per month: harmonized hotspots (VIIRS-equivalent) with P10–P90, source flag, and
          the raw count of each sensor (MODIS Terra, Aqua, VIIRS S-NPP, NOAA-20).
        </p>
      </div>
    </div>
  );
}
