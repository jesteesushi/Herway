// HerWay nav edge function — geocoding and routing
// Deploy: supabase functions deploy nav
// Secrets required: ORS_API_KEY (free openrouteservice.org key)
// Optional: OSRM_BASE_URL (self-hosted OSRM fallback, driving only)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const inBD = (lng: number, lat: number) =>
  lng > 88 && lng < 92.7 && lat > 20.5 && lat < 26.7;

// In-memory cache (cleared when instance recycles)
const cache = new Map<string, { t: number; v: unknown }>();
const remember = (k: string, v: unknown) => {
  if (cache.size > 500) cache.clear();
  cache.set(k, { t: Date.now(), v });
};
const recall = (k: string, ttl: number) => {
  const e = cache.get(k);
  return e && Date.now() - e.t < ttl ? e.v : null;
};

// ORS profile names
const PROFILES: Record<string, string> = {
  walk: "foot-walking",
  drive: "driving-car",
  cycle: "cycling-regular",
};

const UA = "HerWay/1.0 (safety-map@herway.app)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const b = await req.json().catch(() => null);
  if (!b) return json({ error: "bad_request" }, 400);

  try {
    // ── GEOCODE ──────────────────────────────────────────────────────────────
    if (b.action === "geocode") {
      const q = String(b.q ?? "").trim().slice(0, 100);
      if (q.length < 2) return json({ results: [] });

      const key = "g:" + q.toLowerCase();
      const hit = recall(key, 600_000); // 10-minute cache
      if (hit) return json(hit);

      // Bias toward Dhaka if no coordinates given
      const bias =
        Number.isFinite(b.lat) && Number.isFinite(b.lng)
          ? `&lat=${b.lat}&lon=${b.lng}`
          : "&lat=23.8&lon=90.4";

      const r = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&bbox=88.0,20.5,92.7,26.7${bias}`,
        { signal: AbortSignal.timeout(6000), headers: { "User-Agent": UA } },
      );

      if (r.status === 429) return json({ error: "rate_limited" }, 429);
      if (!r.ok) return json({ error: "geocoder_unavailable" }, 502);

      const j = await r.json();
      const out = {
        results: (j.features ?? [])
          .map((f: any) => ({
            name: [
              f.properties.name ?? f.properties.street,
              f.properties.district ?? f.properties.city,
              f.properties.state,
            ]
              .filter(Boolean)
              .join(", "),
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
          .filter((p: any) => p.name && inBD(p.lng, p.lat)),
      };

      remember(key, out);
      return json(out);
    }

    // ── ROUTE ─────────────────────────────────────────────────────────────────
    if (b.action === "route") {
      const ok = (p: any) =>
        p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && inBD(p.lng, p.lat);

      if (!ok(b.from) || !ok(b.to))
        return json({ error: "outside_supported_area" }, 422);

      const mode = PROFILES[b.mode] ? String(b.mode) : "walk";
      const orsKey = Deno.env.get("ORS_API_KEY");

      if (orsKey) {
        // Try with alternatives first; fall back to single route for long trips
        const call = (alt: boolean) =>
          fetch(
            `https://api.openrouteservice.org/v2/directions/${PROFILES[mode]}/geojson`,
            {
              method: "POST",
              signal: AbortSignal.timeout(10000),
              headers: {
                Authorization: orsKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                coordinates: [
                  [b.from.lng, b.from.lat],
                  [b.to.lng, b.to.lat],
                ],
                ...(alt
                  ? {
                      alternative_routes: {
                        target_count: 3,
                        share_factor: 0.6,
                        weight_factor: 1.6,
                      },
                    }
                  : {}),
              }),
            },
          );

        let r = await call(true);
        if (r.status === 400) r = await call(false); // alternatives refused

        if (r.status === 429) return json({ error: "rate_limited" }, 429);

        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.features?.length) return json({ error: "no_route" }, 404);

        return json({
          provider: "openrouteservice",
          mode,
          routes: j.features.map((f: any) => ({
            distance_m: f.properties.summary.distance,
            duration_s: f.properties.summary.duration,
            coordinates: f.geometry.coordinates,
          })),
        });
      }

      // OSRM fallback — driving only, optional self-hosted
      const osrm = Deno.env.get("OSRM_BASE_URL");
      if (osrm && mode === "drive") {
        const r = await fetch(
          `${osrm}/route/v1/driving/${b.from.lng},${b.from.lat};${b.to.lng},${b.to.lat}?overview=full&geometries=geojson&alternatives=true`,
          { signal: AbortSignal.timeout(10000) },
        );
        const j = await r.json().catch(() => null);
        if (!r.ok || j?.code !== "Ok" || !j.routes?.length)
          return json({ error: "no_route" }, 404);
        return json({
          provider: "osrm",
          mode,
          routes: j.routes.map((x: any) => ({
            distance_m: x.distance,
            duration_s: x.duration,
            coordinates: x.geometry.coordinates,
          })),
        });
      }

      return json({ error: "routing_not_configured" }, 501);
    }
  } catch {
    return json({ error: "timeout" }, 504);
  }

  return json({ error: "bad_request" }, 400);
});
