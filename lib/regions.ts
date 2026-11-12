/**
 * Preset areas of interest (hero stories, CLAUDE.md §3.1).
 *
 * The outlines are APPROXIMATE bounding boxes drawn around each area, not official
 * administrative boundaries; the UI says so. Precise boundaries are a later improvement.
 */
import { site } from "@/lib/site";

export type Preset = {
  slug: string;
  name: string;
  nameBn?: string;
  description: string;
  /** [west, south, east, north] in degrees. */
  bbox: [number, number, number, number];
};

export const PRESETS: Preset[] = [
  {
    slug: "chittagong-hill-tracts",
    name: "Chittagong Hill Tracts (Bangladesh)",
    nameBn: "পার্বত্য চট্টগ্রাম",
    description: "Jhum (shifting cultivation) burning season, typically February to April.",
    bbox: [91.6, 21.2, 92.7, 23.7],
  },
  {
    slug: "mizoram",
    name: "Mizoram (India)",
    description: "Hill state with large-scale jhum burning, mainly March and April.",
    bbox: [92.2, 21.9, 93.5, 24.5],
  },
  {
    slug: "tripura",
    name: "Tripura (India)",
    description: "Jhum and agricultural burning in the hills bordering Bangladesh.",
    bbox: [91.1, 22.9, 92.3, 24.6],
  },
  {
    slug: "manipur",
    name: "Manipur (India)",
    description: "Hill districts with seasonal jhum burning.",
    bbox: [93.0, 23.8, 94.8, 25.7],
  },
  {
    slug: "sundarbans",
    name: "Sundarbans (Bangladesh and India)",
    nameBn: "সুন্দরবন",
    description: "Protected mangrove forest: fires are rare, so any hotspot is an anomaly.",
    bbox: [88.1, 21.5, 89.9, 22.6],
  },
  {
    slug: "whole-region",
    name: "Whole loaded region",
    description: "Bangladesh, Northeast India and western Myanmar (the full data extent).",
    bbox: [site.region.west, site.region.south, site.region.east, site.region.north],
  },
];

export function findPreset(slug: string): Preset | undefined {
  return PRESETS.find((p) => p.slug === slug);
}
