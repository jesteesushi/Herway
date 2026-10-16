import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// maplibre-gl is excluded from Vite pre-bundling (vite.config.ts) so it can find its own worker file.
export { maplibregl };
