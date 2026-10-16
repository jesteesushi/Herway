import { createServerFn } from "@tanstack/react-start";

// Bangladesh bounding box: minLon,minLat,maxLon,maxLat
const BD_BBOX = "88.0,20.5,92.7,26.7";

export type GeoResult = { name: string; lat: number; lng: number };

/**
 * Geocoding proxy — Photon (photon.komoot.io) with BD bbox, Nominatim fallback.
 * Keys stay server-side; rate-limit enforcement is here, not in the client.
 */
export const geocodeFn = createServerFn({ method: "GET" })
  .validator((d: { q: string }) => d)
  .handler(async ({ data: { q } }) => {
    const query = q.trim().slice(0, 100);
    if (query.length < 3) return { results: [] as GeoResult[] };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);

    try {
      const r = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en&bbox=${BD_BBOX}`,
        {
          signal: ctrl.signal,
          headers: { "User-Agent": "HerWay/1.0 (safety-map@herway.app)" },
        },
      );
      if (r.status === 429) throw new Error("rate_limited");
      if (!r.ok) throw new Error("geocoder_unavailable");
      const j = await r.json() as { features?: any[] };
      const results: GeoResult[] = (j.features ?? []).map((f: any) => ({
        name: [f.properties.name, f.properties.district ?? f.properties.city, f.properties.state]
          .filter(Boolean)
          .join(", "),
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
      return { results };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "timeout";
      // Nominatim fallback — 1 req/s policy, only used when Photon fails
      if (msg !== "rate_limited") {
        try {
          const rb = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=bd&format=json&limit=5`,
            { headers: { "User-Agent": "HerWay/1.0 (safety-map@herway.app)" } },
          );
          if (rb.ok) {
            const items = await rb.json() as any[];
            const results: GeoResult[] = items.map((i: any) => ({
              name: i.display_name?.split(",").slice(0, 3).join(", ") ?? query,
              lat: Number(i.lat),
              lng: Number(i.lon),
            }));
            return { results };
          }
        } catch { /* ignore fallback error */ }
      }
      return { results: [] as GeoResult[], error: msg };
    } finally {
      clearTimeout(timer);
    }
  });

export type RouteResult = {
  routes: Array<{
    distance_m: number;
    duration_s: number;
    /** [lng, lat][] from OSRM geojson overview */
    coordinates: [number, number][];
  }>;
};

/**
 * Routing proxy — OSRM (driving profile only).
 * Requires OSRM_BASE_URL env var; returns 501 if not configured so the demo
 * server is never silently hit.
 * Label the summary "driving route" in the UI; walking/rickshaw not yet available.
 */
export const routeFn = createServerFn({ method: "GET" })
  .validator(
    (d: { fromLng: number; fromLat: number; toLng: number; toLat: number }) => d,
  )
  .handler(async ({ data: { fromLng, fromLat, toLng, toLat } }) => {
    const base = process.env.OSRM_BASE_URL;
    if (!base) return { error: "routing_not_configured" as const, routes: [] };

    const inBD = (lng: number, lat: number) =>
      lng > 88 && lng < 92.7 && lat > 20.5 && lat < 26.7;

    if (!inBD(fromLng, fromLat) || !inBD(toLng, toLat)) {
      return { error: "outside_supported_area" as const, routes: [] };
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);

    try {
      const url =
        `${base}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}` +
        `?overview=full&geometries=geojson&alternatives=true`;
      const r = await fetch(url, { signal: ctrl.signal });
      if (r.status === 429) return { error: "rate_limited" as const, routes: [] };
      const j = await r.json() as any;
      if (!r.ok || j.code !== "Ok" || !j.routes?.length) {
        return { error: "no_route" as const, routes: [] };
      }
      const routes: RouteResult["routes"] = j.routes.map((x: any) => ({
        distance_m: x.distance,
        duration_s: x.duration,
        coordinates: x.geometry.coordinates as [number, number][],
      }));
      return { error: null, routes };
    } catch {
      return { error: "timeout" as const, routes: [] };
    } finally {
      clearTimeout(timer);
    }
  });
