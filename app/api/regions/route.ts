import { PRESETS } from "@/lib/regions";

/** GET /api/regions: preset areas as a GeoJSON FeatureCollection (static, prerendered). */
export async function GET() {
  return Response.json({
    type: "FeatureCollection",
    features: PRESETS.map((p) => {
      const [w, s, e, n] = p.bbox;
      return {
        type: "Feature",
        id: p.slug,
        properties: {
          slug: p.slug,
          name: p.name,
          nameBn: p.nameBn ?? null,
          description: p.description,
          approximate: true,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
      };
    }),
  });
}
