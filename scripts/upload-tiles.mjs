// Uploads the detection tiles (data/tiles: *.csv.gz + manifest.json) to the Vercel Blob store
// "agni-tiles" under tiles/<dataset_version>/, publicly readable at stable paths.
//   node --env-file=.env scripts/upload-tiles.mjs [tiles-dir]
// Needs BLOB_READ_WRITE_TOKEN. Prints the base URL to use as TILES_BASE_URL.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { put } from "@vercel/blob";

const dir = process.argv[2] ?? "data/tiles";
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const prefix = `tiles/${manifest.dataset_version}`;
const files = readdirSync(dir).filter((f) => f.endsWith(".csv.gz"));
files.push("manifest.json"); // last, so readers never see a manifest listing missing tiles

let base = null;
let bytes = 0;
for (const [i, name] of files.entries()) {
  const body = readFileSync(join(dir, name));
  const res = await put(`${prefix}/${name}`, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: name.endsWith(".json") ? "application/json" : "application/gzip",
    cacheControlMaxAge: 86400,
  });
  bytes += body.length;
  base ??= res.url.slice(0, res.url.lastIndexOf("/"));
  if ((i + 1) % 10 === 0 || i === files.length - 1) {
    console.log(`${i + 1}/${files.length} uploaded (${(bytes / 1e6).toFixed(1)} MB)`);
  }
}
console.log(`TILES_BASE_URL=${base}`);
