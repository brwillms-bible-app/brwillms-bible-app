// MapLibre GL v6 runs its tile worker from a separate ES module file. Copy it into /public
// so the browser can load it from our own origin (see MapPanel -> setWorkerUrl).
import fs from "node:fs";
fs.mkdirSync("public/vendor/maplibre", { recursive: true });
fs.copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre/maplibre-gl-worker.mjs");
console.log("Copied MapLibre worker to public/vendor/maplibre/");
