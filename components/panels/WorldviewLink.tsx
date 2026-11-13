"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Aoi } from "@/lib/contracts";
import { AoiError, resolveAoi } from "@/lib/aoi";
import { monthLabel } from "@/lib/format";
import { dayOf, daysInMonth, WORLDVIEW_FIRES_FROM, worldviewUrl } from "@/lib/worldview";

/**
 * "See it from space": opens NASA Worldview on the area for one day of the selected month, with
 * the satellite image and that era's fire detections. Worldview shows one day at a time.
 */
export function WorldviewLink({ aoi, month }: { aoi: Aoi; month: string }) {
  const [day, setDay] = useState(15);
  let bbox;
  try {
    bbox = resolveAoi(aoi).bbox;
  } catch (e) {
    if (e instanceof AoiError) return null;
    throw e;
  }
  const date = dayOf(month, day);
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3 text-sm">
      <p className="font-medium">See it from space</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Day
          <input
            type="number"
            min={1}
            max={daysInMonth(month)}
            value={Number(date.slice(8))}
            onChange={(e) => setDay(Number(e.target.value) || 1)}
            className="w-14 rounded-md border bg-background px-1.5 py-1 text-sm text-foreground tabular-nums"
          />
          of {monthLabel(month)}
        </label>
        <a
          href={worldviewUrl(bbox, date)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-medium hover:bg-accent"
        >
          <ExternalLink className="size-4" aria-hidden /> Open {date} in NASA Worldview
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        True-colour satellite image (VIIRS from 2016, MODIS before) with that day&apos;s fire
        detections from the sensor Agni uses as reference (MODIS before 2012, VIIRS after; MODIS
        stays available as a hidden layer for comparison). Clouds and smoke can hide fires on any
        single day.
      </p>
      {date < WORLDVIEW_FIRES_FROM && (
        <p className="text-xs text-muted-foreground">
          Worldview&apos;s MODIS fire layer starts in July 2002 (Terra + Aqua combined), so for this
          day it shows the satellite image only.
        </p>
      )}
    </div>
  );
}
