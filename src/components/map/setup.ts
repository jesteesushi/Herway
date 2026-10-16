import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Set worker URL explicitly to public asset to prevent 404 in Vite/Vercel bundles
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

export { maplibregl };
