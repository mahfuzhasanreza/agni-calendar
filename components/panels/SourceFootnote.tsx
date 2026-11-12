import { DATA_SOURCE } from "@/lib/sensors";

/** Data credit shown under every chart (CLAUDE.md §9). */
export function SourceFootnote() {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Source: {DATA_SOURCE} Grid 0.1°; vegetation fires only (FIRMS type 0); MODIS confidence ≥ 30,
      VIIRS nominal or high. Dates in UTC.
    </p>
  );
}
