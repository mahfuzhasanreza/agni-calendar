import { analyze } from "@/lib/analyze";

// Node.js runtime is the default; see CLAUDE.md §6 (no `export const runtime` under Next 16).
export const maxDuration = 30;

/** POST /api/analyze: body = AnalyzeRequest (lib/contracts.ts). */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const result = await analyze(body);
  return Response.json(result.body, {
    status: result.ok ? 200 : result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * GET /api/analyze?preset=slug[&mode=raw&start=YYYY-MM&end=YYYY-MM&selectedMonth=YYYY-MM]
 * Preset-only variant whose responses the CDN may cache (the data changes at most daily).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const preset = params.get("preset");
  if (!preset) {
    return Response.json(
      { error: "GET needs ?preset=slug; use POST for other areas" },
      { status: 400 },
    );
  }
  const input: Record<string, unknown> = { aoi: { type: "preset", slug: preset } };
  for (const key of ["mode", "start", "end", "selectedMonth"]) {
    const v = params.get(key);
    if (v) input[key] = v;
  }
  const result = await analyze(input);
  return Response.json(result.body, {
    status: result.ok ? 200 : result.status,
    headers: {
      "Cache-Control": result.ok
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "no-store",
    },
  });
}
