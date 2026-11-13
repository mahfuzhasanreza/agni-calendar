import { ExternalLink } from "lucide-react";
import type { Aoi } from "@/lib/contracts";
import { AoiError, resolveAoi } from "@/lib/aoi";
import { bboxText, FIRMS_URLS } from "@/lib/firms";

const linkClass =
  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent";

/**
 * Hands the responder over to NASA FIRMS for what Agni does not do: live fires and alerts.
 * FIRMS documents no deep-link format for the Fire Map, so we link the map itself and give the
 * area's box in the "west,south,east,north" form the FIRMS alert "Custom Region" accepts.
 */
export function FirmsLinks({ aoi }: { aoi: Aoi }) {
  let box: string | null = null;
  try {
    box = bboxText(resolveAoi(aoi).bbox);
  } catch (e) {
    if (!(e instanceof AoiError)) throw e;
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Agni is a history and anomaly tool, updated from the FIRMS archive. For fires burning right
        now, NASA FIRMS shows detections within about 3 hours of the satellite overpass and can
        email you when a fire is detected in your area (free; MODIS, VIIRS NOAA-20 and NOAA-21).
      </p>
      <div className="flex flex-wrap gap-2">
        <a className={linkClass} href={FIRMS_URLS.fireMap} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" aria-hidden /> FIRMS Fire Map (live)
        </a>
        <a className={linkClass} href={FIRMS_URLS.alerts} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" aria-hidden /> FIRMS fire alerts by email
        </a>
      </div>
      {box && (
        <p className="text-xs text-muted-foreground">
          For an alert on this area, choose <em>Custom Region</em> and enter its bounding box (west,
          south, east, north):{" "}
          <code className="rounded bg-muted px-1 py-0.5 select-all" data-testid="firms-bbox">
            {box}
          </code>
        </p>
      )}
    </div>
  );
}
