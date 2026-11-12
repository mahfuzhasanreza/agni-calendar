import "server-only";
/**
 * Raw-detection export from the 1° gzip CSV tiles (free-tier design: detections are not in
 * Postgres). Tiles live in the public Vercel Blob store "agni-tiles" in production (uploaded by
 * scripts/upload-tiles.mjs, checksums verified) and in data/tiles locally / in CI.
 * Each tile is sorted by date, so reading stops as soon as the date range is passed.
 */
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { BboxTuple } from "@/lib/aoi";

/** Public Vercel Blob location of the tiles (dataset version data-v1). */
export const DEFAULT_TILES_BASE_URL =
  "https://bkzfzh1vawqsplfa.public.blob.vercel-storage.com/tiles/data-v1";

export type TileInfo = {
  key: string;
  file: string;
  bbox: [number, number, number, number];
  rows: number;
  date_min: string;
  date_max: string;
};
export type Manifest = { dataset_version: string; columns: string[]; tiles: TileInfo[] };

export function tilesBaseUrl(): string {
  return (process.env.TILES_BASE_URL || DEFAULT_TILES_BASE_URL).replace(/\/$/, "");
}

/** file:// URLs are relative to the working directory when written as file://./path. */
function localPath(url: string): string {
  return url.startsWith("file://./") ? url.slice("file://".length) : fileURLToPath(url);
}

async function openStream(url: string): Promise<ReadableStream<Uint8Array>> {
  if (url.startsWith("file://")) {
    return Readable.toWeb(createReadStream(localPath(url))) as ReadableStream<Uint8Array>;
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`could not fetch ${url}: HTTP ${res.status}`);
  return res.body;
}

let manifestPromise: Promise<Manifest> | null = null;

/** Manifest, cached for the life of the server instance (tiles change only with a new release). */
export function getManifest(): Promise<Manifest> {
  manifestPromise ??= (async () => {
    const stream = await openStream(`${tilesBaseUrl()}/manifest.json`);
    return JSON.parse(await new Response(stream).text()) as Manifest;
  })().catch((e) => {
    manifestPromise = null; // retry next time
    throw e;
  });
  return manifestPromise;
}

/** Tiles whose bbox intersects the AOI bbox and whose dates overlap the range. */
export function selectTiles(
  manifest: Manifest,
  bbox: BboxTuple,
  startDate: string,
  endDate: string,
): TileInfo[] {
  const [w, s, e, n] = bbox;
  return manifest.tiles.filter(
    (t) =>
      t.bbox[0] < e &&
      t.bbox[2] > w &&
      t.bbox[1] < n &&
      t.bbox[3] > s &&
      t.date_max >= startDate &&
      t.date_min <= endDate,
  );
}

/** Async iterator over the text lines of a gzip-compressed stream. */
export async function* gzipLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const text = stream
    .pipeThrough(
      new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>,
    )
    .pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>);
  let buffer = "";
  for await (const chunk of text as unknown as AsyncIterable<string>) {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      yield buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer) yield buffer;
}

export type ExportOptions = {
  bbox: BboxTuple;
  contains: (lon: number, lat: number) => boolean;
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string; // YYYY-MM-DD inclusive
  maxRows: number;
};

/**
 * CSV lines (header first) of every detection inside the AOI and date range, across tiles.
 * Yields a final "# …" note line when maxRows is reached.
 */
export async function* exportDetections(opt: ExportOptions): AsyncGenerator<string> {
  const manifest = await getManifest();
  yield manifest.columns.join(",");
  const lat = manifest.columns.indexOf("lat");
  const lon = manifest.columns.indexOf("lon");
  let rows = 0;
  for (const tile of selectTiles(manifest, opt.bbox, opt.startDate, opt.endDate)) {
    let header = true;
    for await (const line of gzipLines(await openStream(`${tilesBaseUrl()}/${tile.file}`))) {
      if (header) {
        header = false;
        continue;
      }
      const date = line.slice(0, 10);
      if (date < opt.startDate) continue;
      if (date > opt.endDate) break; // tiles are sorted by date
      const f = line.split(",");
      if (!opt.contains(Number(f[lon]), Number(f[lat]))) continue;
      yield line;
      if (++rows >= opt.maxRows) {
        yield `# truncated at ${opt.maxRows.toLocaleString("en-US")} rows: choose a smaller area or date range`;
        return;
      }
    }
  }
}
