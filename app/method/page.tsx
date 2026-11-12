import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MethodReport } from "@/components/method/MethodReport";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Method | ${site.name}`,
  description: "How Agni harmonizes MODIS and VIIRS active-fire hotspots, and how well it works.",
};

const STEPS = [
  ["Clean", "Vegetation fires only (FIRMS type 0); MODIS confidence ≥ 30, VIIRS nominal or high."],
  ["Grid", "Count detections per 0.1° cell per month, 2000 to today."],
  [
    "Pick consistent references",
    "MODIS = Terra + Aqua (Terra alone before July 2002, scaled up); VIIRS = S-NPP, continued by NOAA-20 after S-NPP stopped in November 2026.",
  ],
  [
    "Calibrate on the overlap",
    "In 2012–2025 both sensors watched the same fires. Learn how many VIIRS detections one MODIS detection corresponds to, in each 1° tile and season.",
  ],
  [
    "Validate honestly",
    "Leave one year out, predict it from MODIS, compare with what VIIRS saw. Repeat for every year.",
  ],
  [
    "Publish one record",
    "Every month in VIIRS-equivalent units: observed after 2012, calibrated before, with uncertainty bands on the estimates.",
  ],
];

export default function MethodPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <SiteHeader current="method" />
      <main className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              <h2>How Agni makes 25 years comparable</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
            <p>
              MODIS (1 km pixels, since 2000) and VIIRS (375 m, since 2012) count fires differently:
              over the same months VIIRS reports about <strong>5 times more detections</strong>,
              because it also sees small fires. Joining them naively makes fire look as if it
              exploded in 2012. Agni converts the MODIS years into VIIRS-equivalent counts, so the
              whole record speaks one unit.
            </p>
            <ol className="grid gap-3 sm:grid-cols-2">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {i + 1}. {title}
                  </p>
                  <p className="text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
            <h3 className="pt-2 text-base font-semibold">What we learned while validating</h3>
            <p>
              The VIIRS/MODIS ratio is not one number. Across 1° tiles it ranges from about 2.7 to
              26 (median 5.4): around 3 in the jhum hills, where large burns are already visible to
              MODIS, and 6–8 in agricultural plains, where many small fires are only seen by VIIRS.
              A single regional ratio scored well on regional totals but overestimated the
              Chittagong Hill Tracts before 2012 by about 30 %. Agni therefore learns the ratio per
              tile and season, and selects models on tile-sized totals.
            </p>
            <p>
              <strong>Why it matters:</strong> in the Chittagong Hill Tracts the raw record shows
              fire significantly <em>increasing</em> (+374 hotspots per year, 2003–2025); the
              harmonized record shows it significantly <em>decreasing</em> (−470 per year). The
              apparent increase was the sensor switch.
            </p>
            <h3 className="pt-2 text-base font-semibold">Limitations</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Fires too small for MODIS cannot be recovered. Where MODIS saw almost nothing (e.g.
                the Sundarbans), part of the 2012 step remains: compare such areas within the VIIRS
                era only.
              </li>
              <li>
                Single 0.1° cells are much less certain than area totals; the bands describe area
                totals.
              </li>
              <li>
                2000–2002 rely on MODIS Terra alone (morning overpass), the least certain years;
                trends start in 2003.
              </li>
              <li>Preset areas are approximate boxes, not official boundaries. Dates are UTC.</li>
            </ul>
            <p>
              Full write-up with every number:{" "}
              <a
                className="underline underline-offset-4"
                href={`${site.repoUrl}/blob/main/docs/METHOD.md`}
              >
                docs/METHOD.md
              </a>
              .
            </p>
          </CardContent>
        </Card>
        <MethodReport />
      </main>
      <SiteFooter />
    </div>
  );
}
