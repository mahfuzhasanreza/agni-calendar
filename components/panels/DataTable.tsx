/** Table alternative for a chart (every chart has one: CLAUDE.md §6). */
export type Column<T> = {
  key: string;
  label: string;
  value: (row: T) => string;
  numeric?: boolean;
};

export function DataTable<T>({
  rows,
  columns,
  caption,
  summary = "Show the data as a table",
}: {
  rows: T[];
  columns: Column<T>[];
  caption: string;
  summary?: string;
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      <div className="mt-2 max-h-80 overflow-auto rounded-md border">
        <table className="w-full border-collapse tabular-nums">
          <caption className="p-2 text-left text-xs text-muted-foreground">{caption}</caption>
          <thead className="sticky top-0 bg-background">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`p-1.5 font-medium ${c.numeric ? "text-right" : "text-left"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={c.key} className={`p-1.5 ${c.numeric ? "text-right" : "text-left"}`}>
                    {c.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
