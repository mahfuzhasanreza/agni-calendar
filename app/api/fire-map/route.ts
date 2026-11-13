import { connection } from "next/server";
import { queryFireMap } from "@/lib/sql/fire-map";

// Node.js runtime is the default; see CLAUDE.md §6 (no `export const runtime` under Next 16).
export const maxDuration = 30;

/**
 * GET /api/fire-map: per-cell yearly hotspot totals (harmonized + raw) for the whole region,
 * for the 3D map. Same for every visitor and changes at most daily, so the CDN caches it.
 */
export async function GET() {
  await connection();
  try {
    const data = await queryFireMap();
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    console.error("[fire-map] query failed:", e);
    return Response.json(
      { error: "fire map data is not available right now" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
