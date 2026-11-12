// Copies MapLibre's web worker into public/ so the browser can load it from our origin.
// Turbopack does not resolve MapLibre 6's worker URL from the bundle ("Worker failed to load"),
// so MapView calls setWorkerUrl("/vendor/maplibre-gl-worker.mjs"). Runs on postinstall, so the
// file always matches the installed maplibre-gl version (it is git-ignored).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// maplibre-gl 6 only exports an ESM entry, so resolve it the ESM way.
const mainEntry = fileURLToPath(import.meta.resolve("maplibre-gl")); // …/dist/maplibre-gl.mjs
const source = join(dirname(mainEntry), "maplibre-gl-worker.mjs");
const target = join(process.cwd(), "public", "vendor", "maplibre-gl-worker.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`maplibre worker → ${target}`);
