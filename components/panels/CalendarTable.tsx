import type { AnalyzeResponse } from "@/lib/contracts";
import { formatCount, monthShort } from "@/lib/format";

/** Table alternative to the calendar heatmap (every chart has one: CLAUDE.md §6). */
export function CalendarTable({
  calendar,
  caption,
}: {
  calendar: AnalyzeResponse["calendar"];
  caption: string;
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Show the calendar as a table
      </summary>
      <div className="mt-2 max-h-96 overflow-auto rounded-md border">
        <table className="w-full border-collapse text-right tabular-nums">
          <caption className="p-2 text-left text-xs text-muted-foreground">{caption}</caption>
          <thead className="sticky top-0 bg-background">
            <tr>
              <th scope="col" className="p-1.5 text-left">
                Year
              </th>
              {Array.from({ length: 12 }, (_, i) => (
                <th key={i} scope="col" className="p-1.5 font-medium">
                  {monthShort(i + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.years.map((year, yi) => (
              <tr key={year} className="border-t">
                <th scope="row" className="p-1.5 text-left font-medium">
                  {year}
                </th>
                {calendar.values[yi].map((v, m) => {
                  const flag = calendar.flags[yi][m];
                  const estimated = flag && flag !== "observed" && flag !== "calibrated";
                  return (
                    <td key={m} className="p-1.5">
                      {v === null ? "—" : formatCount(v)}
                      {estimated ? "*" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        — no data for that month. * estimated value (lower confidence).
      </p>
    </details>
  );
}
