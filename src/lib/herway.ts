import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Enums"]["incident_category"];
export type ReportType = Database["public"]["Enums"]["report_type"];
export type ReportStatus = Database["public"]["Enums"]["report_status"];
export type PublishedIncident = Database["public"]["Tables"]["published_incidents"]["Row"];
export type IncidentReport = Database["public"]["Tables"]["incident_reports"]["Row"];

export const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "harassment", label: "Harassment", hint: "Unwanted comments, gestures or touching" },
  { value: "stalking", label: "Stalking", hint: "Being followed or watched repeatedly" },
  { value: "sexual_assault", label: "Sexual assault", hint: "Any unwanted sexual contact" },
  { value: "other", label: "Other concern", hint: "Another safety concern" },
];

// Map pins are drawn on a canvas, so they need literal colours. Kept muted on purpose.
export const CATEGORY_HEX: Record<Category, string> = {
  harassment: "#A9711F",
  stalking: "#5F5690",
  sexual_assault: "#8A4F66",
  other: "#56666E",
};

export const REPORT_TYPES: { value: ReportType; label: string; short: string; explain: string }[] = [
  { value: "firsthand", label: "Personally experienced", short: "Firsthand", explain: "It happened to me." },
  { value: "witnessed", label: "Directly witnessed", short: "Witnessed", explain: "I saw it happen to someone else." },
  { value: "disclosed", label: "Disclosed to me", short: "Secondhand", explain: "Someone told me it happened to them." },
];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  awaiting_review: "Awaiting review",
  needs_clarification: "Needs clarification",
  published: "Published",
  not_published: "Will not be published",
  removed: "Removed after publication",
};

export const PERIODS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All data" },
] as const;
export type Period = (typeof PERIODS)[number]["value"];

export const DISCLAIMER =
  "This map displays community-reported incidents. It is not a complete record of crime, and it cannot guarantee that any location is safe or unsafe.";

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const reportTypeLabel = (t: ReportType) => REPORT_TYPES.find((x) => x.value === t)?.label ?? t;

export function withinPeriod(dateTo: string, period: Period) {
  if (period === "all") return true;
  const days = Number(period);
  return Date.now() - new Date(dateTo).getTime() <= days * 86400000;
}

export function formatWindow(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
  const a = f.toLocaleDateString("en-GB", opts);
  const b = t.toLocaleDateString("en-GB", opts);
  if (from === to) return `Around ${f.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  return a === b ? `Within ${a}` : `${a} – ${b}`;
}

/** Snap to a ~450 m grid then nudge randomly, so a public pin never reveals the exact spot. */
export function generaliseLocation(lat: number, lng: number) {
  const grid = 0.004;
  const jitter = () => (Math.random() - 0.5) * 0.003;
  return {
    lat: Number((Math.round(lat / grid) * grid + jitter()).toFixed(4)),
    lng: Number((Math.round(lng / grid) * grid + jitter()).toFixed(4)),
  };
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

/** Rough check for phone numbers, emails or social handles in free text. */
export function looksIdentifying(text: string) {
  return /(\+?88)?01[3-9]\d{8}|\b\d{10,}\b|@[a-z0-9_.]{3,}|[\w.]+@[\w.]+\.\w+/i.test(text);
}

export type PlaceResult = { label: string; lat: number; lng: number };

const MAPTILER_API_KEY = (
  (typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_MAPTILER_API_KEY as string) || (import.meta.env.VITE_MAPTILER_KEY as string)
    : "") || ""
).trim();

/**
 * Production-ready place search.
 * Uses MapTiler Geocoding API when VITE_MAPTILER_API_KEY is configured (country: bd, proximity biased).
 * Falls back to Photon search-as-you-type API if no API key is supplied, avoiding public Nominatim limits.
 */
export async function searchPlaces(q: string): Promise<PlaceResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  // 1. MapTiler Production Geocoding
  if (MAPTILER_API_KEY) {
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_API_KEY}&country=bd&limit=6&proximity=90.3563,23.685`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as {
          features?: Array<{
            place_name?: string;
            text?: string;
            geometry?: { coordinates: [number, number] };
          }>;
        };
        if (data.features && data.features.length > 0) {
          return data.features
            .filter((f) => f.geometry && Array.isArray(f.geometry.coordinates))
            .map((f) => ({
              label: f.place_name || f.text || query,
              lat: f.geometry!.coordinates[1],
              lng: f.geometry!.coordinates[0],
            }));
        }
      }
    } catch (err) {
      console.warn("[Geocoder] MapTiler request failed, falling back:", err);
    }
  }

  // 2. High-speed autocomplete fallback (Photon, powered by OSM data, no restrictive 1 req/s cap)
  try {
    const fallbackUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=23.685&lon=90.3563&limit=6&lang=en`;
    const res = await fetch(fallbackUrl, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as {
        features?: Array<{
          geometry: { coordinates: [number, number] };
          properties: {
            name?: string;
            street?: string;
            district?: string;
            city?: string;
            state?: string;
            country?: string;
          };
        }>;
      };
      if (data.features && data.features.length > 0) {
        return data.features
          .filter((f) => f.geometry && Array.isArray(f.geometry.coordinates))
          .map((f) => {
            const p = f.properties || {};
            const parts = [p.name, p.street, p.district || p.city, p.state].filter(Boolean);
            return {
              label: parts.length > 0 ? parts.join(", ") : query,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
            };
          });
      }
    }
  } catch (err) {
    console.warn("[Geocoder] Fallback request failed:", err);
  }

  return [];
}

/**
 * Production map style:
 * If MapTiler key is set, uses MapTiler Dataviz Light vector style.
 * Otherwise uses Positron neutral basemap style.
 */
export const MAP_STYLE = MAPTILER_API_KEY
  ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${MAPTILER_API_KEY}`
  : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export const BD_CENTER: [number, number] = [90.3563, 23.685];
