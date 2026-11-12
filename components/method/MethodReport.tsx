"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationChart } from "@/components/charts/ValidationChart";
import { SourceFootnote } from "@/components/panels/SourceFootnote";
import {
  LEVEL_LABELS,
  MODEL_LABELS,
  num,
  pct,
  signedPct,
  type BandRow,
  type Levels,
  type MethodResponse,
} from "@/lib/method";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

function Table({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="p-2 text-left text-xs text-muted-foreground">{caption}</caption>
        <thead>
          <tr className="bg-muted/50">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`p-2 font-medium ${i ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => (
                <td key={j} className={`p-2 ${j ? "text-right" : "text-left"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const scoreRow = (label: React.ReactNode, s: Levels[keyof Levels]) => [
  label,
  num(s.r2),
  num(s.r),
  pct(s.nmae),
  signedPct(s.bias_pct),
];

const bandRows = (rows: BandRow[]) =>
  rows.map((b) => [
    `${b.season === "dry" ? "Dry (Nov–May)" : "Wet (Jun–Oct)"}, predicted ${b.size}`,
    `×${b.r_lo.toFixed(2)} – ×${b.r_hi.toFixed(2)}`,
    String(b.n),
  ]);

/** Live validation report of the active model (GET /api/method). */
export function MethodReport() {
  const [data, setData] = useState<MethodResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/method")
      .then(async (r) =>
        r.ok ? setData((await r.json()) as MethodResponse) : setError(`HTTP ${r.status}`),
      )
      .catch(() => setError("Could not reach the server."));
  }, []);

  if (error)
    return <p className="text-sm text-destructive">Validation report unavailable: {error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading the validation report…</p>;

  const r = data.report;
  const metric = r.headline_metric;
  const m = r.by_metric[metric];
  const chosen = r.chosen[metric];
  const models = Object.keys(m.models).sort((a, b) => m.models[a].tile.mae - m.models[b].tile.mae);

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Validation: leave one year out"
        description={`Model ${data.modelVersion}: ${MODEL_LABELS[chosen] ?? chosen}, calibrated on ${r.calibration_window[0]} – ${r.calibration_window[1]}.`}
      >
        <p>
          For each overlap year, every candidate model is refitted{" "}
          <strong>without that year</strong> and then predicts it from MODIS alone. The predictions
          are compared with what VIIRS S-NPP actually observed. Models are chosen on{" "}
          <strong>1° tile-month totals</strong> (about 100 grid cells, the size of a typical area a
          user draws), because larger totals average spatial errors away.
        </p>
        <Table
          caption={`Held-out scores, ${metric}, 1° tile-month totals (selection level)`}
          head={["Model", "R²", "Pearson r", "Error (nMAE)", "Bias"]}
          rows={models.map((k) =>
            scoreRow(
              k === chosen ? (
                <strong>{MODEL_LABELS[k] ?? k} (selected)</strong>
              ) : (
                (MODEL_LABELS[k] ?? k)
              ),
              m.models[k].tile,
            ),
          )}
        />
        <Table
          caption={`Selected model at every level, ${metric}`}
          head={["Level", "R²", "Pearson r", "Error (nMAE)", "Bias"]}
          rows={(Object.keys(LEVEL_LABELS) as (keyof Levels)[]).map((lvl) =>
            scoreRow(LEVEL_LABELS[lvl], m.models[chosen][lvl]),
          )}
        />
        <ValidationChart cv={data.cvPredictions} chosen={chosen} />
        <SourceFootnote />
      </Section>

      <Section title="Other checks" description="Also scored on held-out 1° tile-month totals.">
        <Table
          caption="Continuity checks"
          head={["Check", "R²", "Pearson r", "Error (nMAE)", "Bias"]}
          rows={[
            scoreRow("Terra-only years (as if Aqua did not exist)", m.terra_only_path.tile),
            scoreRow(
              `NOAA-20 → S-NPP (after S-NPP ends, ${r.snpp_last_full_month})`,
              m.n20_to_snpp.tile,
            ),
          ]}
        />
        <p>
          The yearly VIIRS/MODIS ratio stays between{" "}
          {Math.min(...Object.values(m.yearly_ratio).slice(1)).toFixed(2)} and{" "}
          {Math.max(...Object.values(m.yearly_ratio).slice(1)).toFixed(2)} from{" "}
          {Number(Object.keys(m.yearly_ratio)[1])} on, with no trend, so MODIS orbital drift does
          not bias the calibration window. Region-wide S-NPP outages detected:{" "}
          {r.snpp_outage_months.length ? r.snpp_outage_months.join(", ") : "none"}.
        </p>
      </Section>

      <Section
        title="Uncertainty bands"
        description="How far the true total can be from the estimate, for months before VIIRS."
      >
        <p>{m.bands.definition}. Applied to each estimated month and summed over your area.</p>
        <Table
          caption="P10–P90 multiplier on the estimate (MODIS era)"
          head={["Stratum", "P10 – P90", "Samples"]}
          rows={bandRows(m.bands.calibrated)}
        />
        <Table
          caption="Terra-only years (wider)"
          head={["Stratum", "P10 – P90", "Samples"]}
          rows={bandRows(m.bands.terra_only)}
        />
      </Section>
    </div>
  );
}
