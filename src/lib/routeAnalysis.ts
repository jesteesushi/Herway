// src/lib/routeAnalysis.ts
// Pure geometric analysis of published incidents near a planned route.
// ONLY receives rows from the published_incidents view — no private data.

export type LngLat = [number, number];

/** Subset of PublishedIncident fields needed by analysis. */
export type PublicIncident = {
  id: string;
  category: string;
  /** Mapped from report_type */
  source_name: string | null;
  source_url: string | null;
  /** lat/lng from published_incidents */
  latitude: number | null;
  longitude: number | null;
  /** All published records are treated as 'area' precision (coords are jittered by ~450m server-side) */
  location_precision: "exact" | "area" | "locality" | "district" | "unknown";
  /** Mapped from date_to */
  incident_occurred_at: string | null;
  /** Mapped from published_at */
  source_published_at: string | null;
  publication_status: string;
  summary: string | null;
  district: string | null;
};

const R = 6371000;
const M_PER_DEG_LAT = (Math.PI / 180) * R;

export function haversine(a: LngLat, b: LngLat): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function distToSegment(p: LngLat, a: LngLat, b: LngLat): number {
  const kx = Math.cos((p[1] * Math.PI) / 180) * M_PER_DEG_LAT,
    ky = M_PER_DEG_LAT;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distToRoute(p: LngLat, line: LngLat[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++)
    best = Math.min(best, distToSegment(p, line[i], line[i + 1]));
  return best;
}

export type Filters = { from?: string; to?: string; categories?: string[] };
export type Analysis = {
  corridor: PublicIncident[];
  origin: PublicIncident[];
  destination: PublicIncident[];
  approximateNearby: PublicIncident[];
  imprecise: PublicIncident[];
  mostRecent: PublicIncident | null;
};

export function analyzeRoute(
  route: LngLat[],
  incidents: PublicIncident[],
  opts: { corridor_m?: number; radius_m?: number; filters?: Filters } = {}
): Analysis {
  const corridor_m = opts.corridor_m ?? 200,
    radius_m = opts.radius_m ?? 500;
  const f = opts.filters ?? {};
  const origin = route[0], dest = route[route.length - 1];

  const seen = new Set<string>();
  const pool = incidents.filter((i) => {
    const key = i.source_url || i.id;
    if (seen.has(key)) return false;
    seen.add(key);
    if (f.categories?.length && !f.categories.includes(i.category)) return false;
    const d = i.incident_occurred_at ?? i.source_published_at;
    if (d && f.from && d < f.from) return false;
    if (d && f.to && d > f.to) return false;
    return true;
  });

  const out: Analysis = {
    corridor: [],
    origin: [],
    destination: [],
    approximateNearby: [],
    imprecise: [],
    mostRecent: null,
  };

  const buffer = Math.max(corridor_m, radius_m) / M_PER_DEG_LAT;
  const lngs = route.map((c) => c[0]),
    lats = route.map((c) => c[1]);
  const box = [
    Math.min(...lngs) - buffer * 1.2,
    Math.min(...lats) - buffer,
    Math.max(...lngs) + buffer * 1.2,
    Math.max(...lats) + buffer,
  ];

  for (const i of pool) {
    if (
      i.latitude == null ||
      i.longitude == null ||
      i.location_precision === "unknown" ||
      i.location_precision === "district"
    ) {
      out.imprecise.push(i);
      continue;
    }
    const p: LngLat = [i.longitude, i.latitude];
    if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3]) continue;

    const nearOrigin = haversine(p, origin) <= radius_m;
    const nearDest = haversine(p, dest) <= radius_m;
    const nearRoute = distToRoute(p, route) <= corridor_m;

    if (i.location_precision === "exact") {
      if (nearOrigin) out.origin.push(i);
      if (nearDest) out.destination.push(i);
      if (nearRoute) out.corridor.push(i);
    } else if (nearOrigin || nearDest || nearRoute) {
      out.approximateNearby.push(i);
    }
  }

  const all = [
    ...out.corridor,
    ...out.origin,
    ...out.destination,
    ...out.approximateNearby,
  ];
  out.mostRecent =
    all.sort((a, b) =>
      (b.incident_occurred_at ?? b.source_published_at ?? "").localeCompare(
        a.incident_occurred_at ?? a.source_published_at ?? ""
      )
    )[0] ?? null;
  return out;
}
