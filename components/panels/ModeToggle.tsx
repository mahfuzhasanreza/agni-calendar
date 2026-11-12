"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type Mode = "harmonized" | "raw";

/** Raw vs harmonized switch: the "watch the 2012 jump disappear" control. */
export function ModeToggle({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id="mode-label" className="text-sm font-medium">
        Sensor record
      </span>
      <ToggleGroup
        aria-labelledby="mode-label"
        value={[mode]}
        onValueChange={(v) => {
          const next = v[0] as Mode | undefined;
          if (next) onMode(next);
        }}
        variant="outline"
      >
        <ToggleGroupItem value="harmonized">Harmonized</ToggleGroupItem>
        <ToggleGroupItem value="raw">Raw</ToggleGroupItem>
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        {mode === "raw"
          ? "Raw: MODIS counts until 2012, then VIIRS. The jump in 2012 is the sensor change, not more fire."
          : "Harmonized: every month in one consistent unit (VIIRS S-NPP-equivalent hotspots)."}
      </p>
    </div>
  );
}
