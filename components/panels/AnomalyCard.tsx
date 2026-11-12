"use client";

import { Flame, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS } from "@/lib/colors";
import type { AnalyzeResponse, AnomalyLabel } from "@/lib/contracts";
import { formatCount, monthLabel, monthLong } from "@/lib/format";
import { RECORD_START } from "@/lib/sensors";

const LABELS: Record<
  AnomalyLabel,
  { text: string; icon: typeof Flame; color?: string; explain: string }
> = {
  extreme: {
    text: "Extreme",
    icon: Flame,
    color: STATUS.critical,
    explain: "above the 90th percentile of the baseline",
  },
  above_normal: {
    text: "Above normal",
    icon: TrendingUp,
    color: STATUS.warning,
    explain: "between the 75th and 90th percentile",
  },
  normal: { text: "Normal", icon: Minus, explain: "between the 25th and 75th percentile" },
  below_normal: { text: "Below normal", icon: TrendingDown, explain: "below the 25th percentile" },
};

type Props = {
  anomaly: AnalyzeResponse["anomaly"];
  baseline: AnalyzeResponse["baseline"];
  unitsShort: string;
  mode: "harmonized" | "raw";
  dataThrough: string;
  latestCompleteMonth: string;
  onSelectMonth: (month: string) => void;
};

/** "This month vs history": the selected month against the same month in the baseline years. */
export function AnomalyCard({
  anomaly: a,
  baseline,
  unitsShort,
  mode,
  dataThrough,
  latestCompleteMonth,
  onSelectMonth,
}: Props) {
  const label = LABELS[a.label];
  const Icon = label.icon;
  const monthName = monthLong(Number(a.month.slice(5, 7)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="anomaly-month">Month to compare</Label>
        <Input
          id="anomaly-month"
          type="month"
          min={RECORD_START}
          max={dataThrough}
          value={a.month}
          onChange={(e) => e.target.value && onSelectMonth(e.target.value)}
          className="max-w-48"
        />
        {a.month !== latestCompleteMonth && (
          <button
            type="button"
            onClick={() => onSelectMonth(latestCompleteMonth)}
            className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to the latest complete month ({monthLabel(latestCompleteMonth)})
          </button>
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground">{monthLabel(a.month)}</p>
        <p className="text-4xl font-semibold tabular-nums">{formatCount(a.value)}</p>
        <p className="text-sm text-muted-foreground">{unitsShort}</p>
      </div>

      <div
        className="inline-flex items-center gap-2 self-start rounded-md border px-2.5 py-1.5 text-sm font-medium"
        style={label.color ? { borderColor: label.color } : undefined}
      >
        <Icon
          aria-hidden
          className="size-4"
          style={label.color ? { color: label.color } : undefined}
        />
        {label.text}
        <span className="font-normal text-muted-foreground">({label.explain})</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Typical {monthName}</dt>
        <dd className="text-right tabular-nums">
          {formatCount(a.median)} <span className="text-muted-foreground">median</span>
        </dd>
        <dt className="text-muted-foreground">Usual range (P10–P90)</dt>
        <dd className="text-right tabular-nums">
          {formatCount(a.p10)}–{formatCount(a.p90)}
        </dd>
        <dt className="text-muted-foreground">Percentile rank</dt>
        <dd className="text-right tabular-nums">{a.percentileRank}</dd>
        <dt className="text-muted-foreground">Ratio to median</dt>
        <dd className="text-right tabular-nums">{a.ratio === null ? "—" : `×${a.ratio}`}</dd>
        <dt className="text-muted-foreground">Robust z-score</dt>
        <dd className="text-right tabular-nums">{a.robustZ === null ? "—" : a.robustZ}</dd>
        <dt className="text-muted-foreground">Years with fire</dt>
        <dd className="text-right tabular-nums">
          {a.yearsWithFire} of {a.baselineYears}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        Compared with {monthName} in {baseline.from}–{baseline.to} (excluding {a.month.slice(0, 4)})
        {mode === "harmonized"
          ? ", all in the same harmonized units."
          : ". Raw mode mixes MODIS (before 2012) and VIIRS counts, so this comparison is biased; use Harmonized."}
        {a.median === 0 && a.value > 0 && " Fire was recorded in a month that usually has none."}
      </p>
    </div>
  );
}
