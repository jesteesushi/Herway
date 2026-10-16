import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  Info,
  X,
  Bookmark,
  Flag,
  LifeBuoy,
  ShieldCheck,
  Map as MapIcon,
  List,
  AlertTriangle,
  Loader2,
  Navigation,
  ArrowUpDown,
  LocateFixed,
  Maximize2,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IncidentMap } from "@/components/ClientMap";
import { CategoryBadge, CategoryIcon, ReportTypeBadge } from "@/components/CategoryBadge";
import {
  CATEGORIES,
  CATEGORY_HEX,
  DISCLAIMER,
  PERIODS,
  REPORT_TYPES,
  categoryLabel,
  formatWindow,
  reportTypeLabel,
  withinPeriod,
  BD_CENTER,
  type Category,
  type Period,
  type PublishedIncident,
  type ReportType,
} from "@/lib/herway";
import { geocodeFn, type GeoResult } from "@/lib/geo.functions";
import {
  analyzeRoute,
  type Analysis,
  type LngLat,
  type PublicIncident,
} from "@/lib/routeAnalysis";
import { useAuth } from "@/hooks/use-auth";
import { usePlaceSearch, type Place } from "@/hooks/use-place-search";
import { cn } from "@/lib/utils";
import { PlaceCombobox } from "@/components/map/PlaceCombobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explore the map — HerWay" },
      {
        name: "description",
        content:
          "Explore community-reported safety incidents and plan routes across Bangladesh, with privacy-protected locations and clear limits.",
      },
      { property: "og:title", content: "Explore the map — HerWay" },
      { property: "og:description", content: "Community-reported safety incidents and route planning across Bangladesh." },
    ],
  }),
  component: Explore,
});

type ViewMode = "map" | "list";
type TabMode = "search" | "route";

// Adapter from DB published_incidents to PublicIncident for route analysis
function toPublicIncident(i: PublishedIncident): PublicIncident {
  return {
    id: i.id,
    category: i.category,
    source_name:
      i.report_type === "firsthand"
        ? "Firsthand report"
        : i.report_type === "witnessed"
        ? "Witness account"
        : "Disclosed account",
    source_url: null,
    latitude: i.lat,
    longitude: i.lng,
    location_precision: i.lat != null && i.lng != null ? "exact" : "unknown",
    incident_occurred_at: i.date_to,
    source_published_at: i.published_at,
    publication_status: "published",
    summary: i.summary,
    district: i.area_label,
  };
}

const EMPTY_INCIDENTS: PublishedIncident[] = [];
const EMPTY_SOURCES: Array<{ id: string; last_success_at: string | null }> = [];

function Explore() {
  const { data: incidents = EMPTY_INCIDENTS, isLoading, isError, refetch } = useQuery({
    queryKey: ["published_incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_incidents")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data as PublishedIncident[];
    },
  });

  const { data: sources = EMPTY_SOURCES } = useQuery({
    queryKey: ["sources_stale_check"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("sources").select("id, last_success_at");
        if (error || !data) return [];
        return data as Array<{ id: string; last_success_at: string | null }>;
      } catch {
        return [];
      }
    },
  });

  const isStale48h = useMemo(() => {
    if (!sources || sources.length === 0) return false;
    const now = Date.now();
    const hasRecentSync = sources.some(
      (s) => s.last_success_at && now - new Date(s.last_success_at).getTime() < 48 * 3600 * 1000,
    );
    return !hasRecentSync;
  }, [sources]);

  // Filters
  const [cats, setCats] = useState<Category[]>([]);
  const [types, setTypes] = useState<ReportType[]>([]);
  const [period, setPeriod] = useState<Period>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; key: number } | null>(null);
  const [visible, setVisible] = useState<string[]>([]);
  const [center, setCenter] = useState({ lat: 23.7, lng: 90.4 });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const handleViewChange = useCallback((ids: string[], c: { lat: number; lng: number }) => {
    setVisible((prev) => {
      if (prev.length === ids.length && prev.every((id, idx) => id === ids[idx])) return prev;
      return ids;
    });
    setCenter((prev) => {
      if (Math.abs(prev.lat - c.lat) < 0.0001 && Math.abs(prev.lng - c.lng) < 0.0001) return prev;
      return c;
    });
  }, []);
  const [tabMode, setTabMode] = useState<TabMode>("search");

  // Routing state
  const [fromQuery, setFromQuery] = useState("");
  const [fromPoint, setFromPoint] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [toQuery, setToQuery] = useState("");
  const [toPoint, setToPoint] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [pickMode, setPickMode] = useState<"from" | "to" | null>(null);
  const [routes, setRoutes] = useState<
    Array<{ distance_m: number; duration_s: number; coordinates: [number, number][] }>
  >([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [fitRouteTrigger, setFitRouteTrigger] = useState(0);
  const [routeMode, setRouteMode] = useState<"walk" | "drive" | "cycle">("walk");

  // Map layer state (for Layers popover, remembered in localStorage)
  const [basemap, setBasemap] = useState<"standard" | "light" | "dark" | "auto">(() => {
    try {
      return (localStorage.getItem("herway-basemap") as any) || "auto";
    } catch {
      return "auto";
    }
  });
  const [showIncidents, setShowIncidents] = useState(() => {
    try {
      const v = localStorage.getItem("herway-layer-incidents");
      return v !== null ? v === "true" : true;
    } catch {
      return true;
    }
  });
  const [showHelpPoints, setShowHelpPoints] = useState(() => {
    try {
      return localStorage.getItem("herway-layer-help") === "true";
    } catch {
      return false;
    }
  });
  const [show3DBuildings, setShow3DBuildings] = useState(() => {
    try {
      return localStorage.getItem("herway-layer-3d") === "true";
    } catch {
      return false;
    }
  });
  const [showTransit, setShowTransit] = useState(() => {
    try {
      const v = localStorage.getItem("herway-layer-transit");
      return v !== null ? v === "true" : true;
    } catch {
      return true;
    }
  });
  const [showLabels, setShowLabels] = useState(() => {
    try {
      const v = localStorage.getItem("herway-layer-labels");
      return v !== null ? v === "true" : true;
    } catch {
      return true;
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; label?: string } | null>(null);

  // Source filter chip (Phase 3a #8)
  const [sourceFilter, setSourceFilter] = useState<"all" | "community" | "official" | "news" | "ngo">("all");

  useEffect(() => {
    try {
      localStorage.setItem("herway-basemap", basemap);
      localStorage.setItem("herway-layer-incidents", String(showIncidents));
      localStorage.setItem("herway-layer-help", String(showHelpPoints));
      localStorage.setItem("herway-layer-3d", String(show3DBuildings));
      localStorage.setItem("herway-layer-transit", String(showTransit));
      localStorage.setItem("herway-layer-labels", String(showLabels));
    } catch {}
  }, [basemap, showIncidents, showHelpPoints, show3DBuildings, showTransit, showLabels]);

  // Analysis settings
  const [radiusM, setRadiusM] = useState(500); // 200m - 1000m slider
  const [corridorM] = useState(200); // 200m default

  const filtered = useMemo(
    () =>
      incidents.filter(
        (i) =>
          (!cats.length || cats.includes(i.category)) &&
          (!types.length || types.includes(i.report_type)) &&
          withinPeriod(i.date_to, period),
      ),
    [incidents, cats, types, period],
  );

  const sortedForList = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.date_to).getTime() - new Date(a.date_to).getTime()),
    [filtered],
  );

  const selected = incidents.find((i) => i.id === selectedId) ?? null;
  const lastUpdate = incidents[0]?.published_at;
  const isAllSample = incidents.length > 0 && incidents.every((i) => i.is_sample);
  const hasSample = incidents.some((i) => i.is_sample);
  const isStale = lastUpdate ? Date.now() - new Date(lastUpdate).getTime() > 48 * 3600 * 1000 : false;

  const activeRoute = routes[selectedRouteIdx] ?? null;

  // Run Route Safety Analysis when route is available
  const routeAnalysis: Analysis | null = useMemo(() => {
    if (!activeRoute || activeRoute.coordinates.length < 2) return null;
    const publicPool = incidents.map(toPublicIncident);
    return analyzeRoute(activeRoute.coordinates as LngLat[], publicPool, {
      corridor_m: corridorM,
      radius_m: radiusM,
      filters: {
        categories: cats.length ? cats : undefined,
      },
    });
  }, [activeRoute, incidents, corridorM, radiusM, cats]);

  const coverage = useMemo(() => {
    const vis = filtered.filter((i) => visible.includes(i.id));
    if (vis.length === 0) return { label: "Insufficient data", tone: "bg-muted text-muted-foreground" };
    const recent = vis.some((i) => withinPeriod(i.date_to, "90"));
    if (vis.length >= 5 && recent) return { label: "Recently assessed", tone: "bg-secondary text-secondary-foreground" };
    return { label: "Limited information", tone: "bg-muted text-muted-foreground" };
  }, [filtered, visible]);

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const activeCount = cats.length + types.length + (period !== "all" ? 1 : 0);

  // Map click handler for "Pick on map"
  function handleMapClick(coords: { lat: number; lng: number }) {
    if (pickMode === "from") {
      setFromPoint({ name: `Point (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`, lat: coords.lat, lng: coords.lng });
      setFromQuery(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      setPickMode(null);
      toast.success("Origin set from map");
    } else if (pickMode === "to") {
      setToPoint({ name: `Point (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`, lat: coords.lat, lng: coords.lng });
      setToQuery(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      setPickMode(null);
      toast.success("Destination set from map");
    }
  }

  // Calculate route via nav edge function (hides ORS key, supports Walk/Drive/Cycle)
  async function calculateRoute() {
    if (!fromPoint || !toPoint) {
      setRoutingError("Please enter both an origin and destination.");
      return;
    }
    setRoutingLoading(true);
    setRoutingError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("nav", {
        body: {
          action: "route",
          from: { lat: fromPoint.lat, lng: fromPoint.lng },
          to: { lat: toPoint.lat, lng: toPoint.lng },
          mode: routeMode,
        },
      });

      if (fnError) {
        setRoutes([]);
        setRoutingError("Route could not be calculated. Check your connection and try again.");
        return;
      }

      if (data?.error) {
        setRoutes([]);
        switch (data.error) {
          case "routing_not_configured":
            setRoutingError("Route planning is not set up yet.");
            break;
          case "outside_supported_area":
            setRoutingError("One or both locations are outside Bangladesh.");
            break;
          case "rate_limited":
            setRoutingError("Routing service is temporarily busy. Please wait a moment and try again.");
            break;
          case "timeout":
            setRoutingError("Request timed out. Please try again.");
            break;
          case "no_route":
            setRoutingError("No route found between these locations.");
            break;
          default:
            setRoutingError("Route could not be calculated.");
        }
        return;
      }

      if (!data?.routes?.length) {
        setRoutes([]);
        setRoutingError("Route could not be calculated.");
        return;
      }

      setRoutes(data.routes);
      setSelectedRouteIdx(0);
      setFitRouteTrigger((k) => k + 1);
    } catch {
      setRoutes([]);
      setRoutingError("Route could not be calculated.");
    } finally {
      setRoutingLoading(false);
    }
  }

  function swapFromTo() {
    const tempP = fromPoint;
    const tempQ = fromQuery;
    setFromPoint(toPoint);
    setFromQuery(toQuery);
    setToPoint(tempP);
    setToQuery(tempQ);
    if (routes.length > 0) {
      setRoutes([]);
      setRoutingError(null);
    }
  }

  function resetView() {
    setFlyTo({ lat: BD_CENTER[1], lng: BD_CENTER[0], zoom: 6.3, key: Date.now() });
  }

  function clearRoute() {
    setRoutes([]);
    setRoutingError(null);
    setFromPoint(null);
    setFromQuery("");
    setToPoint(null);
    setToQuery("");
    setPickMode(null);
  }

  const filterPanel = (
    <div className="space-y-5">
      <FilterGroup title="Category">
        {CATEGORIES.map((c) => (
          <Chip key={c.value} active={cats.includes(c.value)} onClick={() => toggle(cats, c.value, setCats)}>
            <CategoryIcon category={c.value} className="size-3.5" /> {c.label}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup title="Reporting period">
        {PERIODS.map((p) => (
          <Chip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</Chip>
        ))}
      </FilterGroup>
      <FilterGroup title="How the reporter knows">
        {REPORT_TYPES.map((t) => (
          <Chip key={t.value} active={types.includes(t.value)} onClick={() => toggle(types, t.value, setTypes)}>{t.label}</Chip>
        ))}
      </FilterGroup>
      {activeCount > 0 && (
        <button
          className="text-sm font-medium text-primary underline"
          onClick={() => { setCats([]); setTypes([]); setPeriod("all"); }}
        >
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] w-full overflow-hidden md:h-dvh">
      {/* ── MAP CONTAINER (fills viewport) ── */}
      <div className="relative h-full w-full">
        <IncidentMap
          incidents={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          flyTo={flyTo}
          searchMarker={searchMarker}
          onViewChange={handleViewChange}
          routeCoordinates={activeRoute?.coordinates ?? null}
          fitRouteTrigger={fitRouteTrigger}
          pickingLocation={pickMode !== null}
          onMapClick={handleMapClick}
          basemap={basemap}
          showIncidents={showIncidents}
          showHelpPoints={showHelpPoints}
          show3DBuildings={show3DBuildings}
          showTransit={showTransit}
          showLabels={showLabels}
        />

        {/* ── TOP-LEFT FLOATING CARD: SEARCH & ROUTE PLANNING ── */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 w-[calc(100%-1.5rem)] max-w-md md:left-4 md:top-4">
          <div className="pointer-events-auto rounded-2xl border bg-card/95 p-3 shadow-float backdrop-blur-md">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex rounded-lg bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => { setTabMode("search"); setPickMode(null); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    tabMode === "search" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Search className="size-3.5" /> Place Search
                </button>
                <button
                  type="button"
                  onClick={() => setTabMode("route")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    tabMode === "route" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Navigation className="size-3.5" /> Plan Route
                </button>
              </div>

              {/* Action buttons on header */}
              <div className="flex items-center gap-1">
                {/* Reset view */}
                <button
                  onClick={resetView}
                  title="Reset view to whole Bangladesh"
                  aria-label="Reset map view"
                  className="grid size-8 place-items-center rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                </button>

                {/* Map/List Toggle */}
                <button
                  onClick={() => setViewMode(viewMode === "map" ? "list" : "map")}
                  title={viewMode === "map" ? "Switch to list view" : "Switch to map view"}
                  aria-label="Toggle map and list view"
                  className="grid size-8 place-items-center rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  {viewMode === "map" ? <List className="size-3.5" /> : <MapIcon className="size-3.5" />}
                </button>

                {/* Collapsible Filters */}
                <button
                  onClick={() => setShowFilters(true)}
                  aria-label="Open filter panel"
                  className="relative grid size-8 place-items-center rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <SlidersHorizontal className="size-3.5" />
                  {activeCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {activeCount}
                    </span>
                  )}
                </button>

                {/* Layers popover (Phase 3a #1) */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      aria-label="Map layers and legend"
                      title="Map layers and legend"
                      className="grid size-8 place-items-center rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Layers className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 space-y-3.5 p-4 text-xs">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">Map Layers</h4>
                      <p className="text-[11px] text-muted-foreground">Adjust style, visibility and POIs</p>
                    </div>

                    {/* Basemap selection */}
                    <div className="space-y-1.5 border-t pt-2.5">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Basemap
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {(["standard", "light", "dark", "auto"] as const).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBasemap(b)}
                            className={cn(
                              "rounded-lg border py-1.5 text-center text-xs font-medium capitalize transition",
                              basemap === b
                                ? "border-primary bg-primary text-primary-foreground font-semibold"
                                : "bg-card hover:bg-muted text-muted-foreground",
                            )}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Layer Toggles */}
                    <div className="space-y-2 border-t pt-2.5">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Features & Overlays
                      </label>
                      <div className="flex items-center justify-between">
                        <span>Incident reports</span>
                        <Switch checked={showIncidents} onCheckedChange={setShowIncidents} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Help points (police, hospital, clinic)</span>
                        <Switch checked={showHelpPoints} onCheckedChange={setShowHelpPoints} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>3D buildings</span>
                        <Switch checked={show3DBuildings} onCheckedChange={setShow3DBuildings} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Transit lines</span>
                        <Switch checked={showTransit} onCheckedChange={setShowTransit} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Labels & names</span>
                        <Switch checked={showLabels} onCheckedChange={setShowLabels} />
                      </div>
                    </div>

                    {/* Legend inside popover (Phase 3a #1 & Phase 3c) */}
                    <div className="space-y-1.5 border-t pt-2.5">
                      <p className="font-semibold text-foreground">Incident Legend</p>
                      {CATEGORIES.map((c) => (
                        <div key={c.value} className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 rounded-full border border-white/80"
                            style={{ background: CATEGORY_HEX[c.value] }}
                          />
                          <span className="text-muted-foreground">{c.label}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1 text-muted-foreground text-[11px]">
                        <span className="inline-block size-3 rounded-full border border-dashed border-primary/60 bg-primary/10" />
                        <span>Circle = approximate area (about 150 m), not an exact spot</span>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
                        {DISCLAIMER}
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Content Area */}
            <div className="mt-3">
              {tabMode === "search" ? (
                <div>
                  <PlaceCombobox
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onPick={(p) => {
                      setSearchMarker(p);
                      setFlyTo({ lat: p.lat, lng: p.lng, zoom: 14.5, key: Date.now() });
                    }}
                    onClear={() => setSearchMarker(null)}
                    centerBias={center}
                    placeholder="Search area, road or landmark in Bangladesh"
                  />
                </div>
              ) : (
                /* Plan Route Controls */
                <div className="space-y-2.5">
                  {/* Transport mode chips */}
                  <div className="flex gap-1.5">
                    {(["walk", "drive", "cycle"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setRouteMode(m); setRoutes([]); setRoutingError(null); }}
                        className={cn(
                          "flex-1 rounded-lg border py-1 text-[11px] font-semibold transition capitalize",
                          routeMode === m
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card hover:bg-muted text-muted-foreground",
                        )}
                      >
                        {m === "walk" ? "🚶 Walk" : m === "drive" ? "🚗 Drive" : "🚴 Cycle"}
                      </button>
                    ))}
                  </div>

                  {pickMode && (
                    <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                      Click anywhere on the map to set <strong>{pickMode === "from" ? "Origin" : "Destination"}</strong>.
                    </div>
                  )}

                  <div className="relative space-y-1.5">
                    {/* From Input */}
                    <PlaceCombobox
                      label="From"
                      value={fromQuery}
                      onChange={setFromQuery}
                      onPick={(p) => { setFromPoint(p); setFromQuery(p.name); }}
                      onClear={() => { setFromPoint(null); setFromQuery(""); }}
                      onPickMap={() => setPickMode(pickMode === "from" ? null : "from")}
                      isPicking={pickMode === "from"}
                      showUseMyLocation={true}
                      centerBias={center}
                      placeholder="Start point or address"
                    />

                    {/* Swap button */}
                    <div className="relative flex justify-end pr-8">
                      <button
                        type="button"
                        onClick={swapFromTo}
                        title="Swap Origin and Destination"
                        aria-label="Swap origin and destination"
                        className="-my-1.5 z-10 grid size-6 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-foreground"
                      >
                        <ArrowUpDown className="size-3" />
                      </button>
                    </div>

                    {/* To Input */}
                    <PlaceCombobox
                      label="To"
                      value={toQuery}
                      onChange={setToQuery}
                      onPick={(p) => { setToPoint(p); setToQuery(p.name); }}
                      onClear={() => { setToPoint(null); setToQuery(""); }}
                      onPickMap={() => setPickMode(pickMode === "to" ? null : "to")}
                      isPicking={pickMode === "to"}
                      showUseMyLocation={false}
                      centerBias={center}
                      placeholder="Destination"
                    />
                  </div>

                  {/* Route & Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={calculateRoute}
                      disabled={routingLoading || !fromPoint || !toPoint}
                      className="flex-1"
                    >
                      {routingLoading ? (
                        <>
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Calculating…
                        </>
                      ) : (
                        <>
                          <Navigation className="mr-1.5 size-3.5" /> Get route
                        </>
                      )}
                    </Button>

                    {routes.length > 0 && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFitRouteTrigger((k) => k + 1)}
                          title="Fit map to route"
                        >
                          <Maximize2 className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearRoute}
                          title="Clear route"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Routing Error display */}
                  {routingError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                      {routingError}
                    </div>
                  )}

                  {/* Route Summary & Alternatives */}
                  {routes.length > 0 && activeRoute && (() => {
                    const modeLabel = routeMode === "walk" ? "Walking" : routeMode === "drive" ? "Driving" : "Cycling";
                    const km = (activeRoute.distance_m / 1000).toFixed(1);
                    const min = Math.round(activeRoute.duration_s / 60);
                    return (
                      <div className="space-y-2 border-t pt-2.5 text-xs">
                        {/* Alternatives chips */}
                        {routes.length > 1 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground font-medium">Options:</span>
                            {routes.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedRouteIdx(idx)}
                                className={cn(
                                  "rounded-md px-2 py-0.5 font-medium transition",
                                  selectedRouteIdx === idx
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                                )}
                              >
                                Route {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Distance & Duration — from response only, no estimates */}
                        <div className="font-semibold text-foreground">
                          {modeLabel} route · {km} km · {min} min
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Routing quality depends on OpenStreetMap coverage in the area.
                        </p>
                        <p className="text-[11px] text-muted-foreground border-t pt-1.5">
                          Routing © openrouteservice.org, data © OpenStreetMap contributors
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Quick status bar */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[11px] text-muted-foreground">
              <span className={cn("rounded-full px-2 py-0.5 font-medium", coverage.tone)}>
                {coverage.label}
              </span>
              <span>·</span>
              <span>{filtered.length} reports</span>
              {hasSample && <span className="font-semibold text-accent-foreground">· Sample data</span>}
            </div>

            {/* Stale-data warning when no source has synced in 48h */}
            {isStale48h && (
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>No sources synced in 48h. Data may be delayed.</span>
                </div>
                <Link to="/sources" className="underline shrink-0 font-medium">
                  Sources
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── SAFETY BRIEFING CARD (When route is active) ── */}
        {activeRoute && routeAnalysis && (
          <aside className="pointer-events-auto absolute bottom-0 right-0 z-20 max-h-[75vh] w-full overflow-y-auto rounded-t-3xl border-t bg-card/98 p-4 shadow-float backdrop-blur-md md:bottom-4 md:right-4 md:max-h-[calc(100vh-2rem)] md:w-96 md:rounded-3xl md:border">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border md:hidden" />

            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Shield className="size-3 text-primary" /> Route Safety Briefing
                </span>
                <h3 className="text-base font-semibold text-foreground">
                  YOUR ROUTE: {(activeRoute.distance_m / 1000).toFixed(1)} km · {Math.round(activeRoute.duration_s / 60)} min (driving)
                </h3>
              </div>
              <button
                onClick={clearRoute}
                aria-label="Close route analysis"
                className="grid size-7 place-items-center rounded-full hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Development fixture notice if all records are samples */}
            {isAllSample && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                <strong>Development data:</strong> not real safety information. All reports in this view are test samples.
              </div>
            )}

            {/* Main Safety Information */}
            <div className="mt-3 space-y-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed">
              <p className="font-semibold text-foreground">
                SAFETY INFORMATION:{" "}
                {routeAnalysis.corridor.length > 0
                  ? `${routeAnalysis.corridor.length} relevant published reports found near the selected route.`
                  : "No matching reports were found in the available dataset."}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1 font-medium">
                <div className="rounded-lg bg-card p-2 border">
                  <span className="text-muted-foreground block text-[10px]">ORIGIN AREA</span>
                  <span className="text-foreground text-sm font-bold">
                    {routeAnalysis.origin.length} within {radiusM} m
                  </span>
                </div>
                <div className="rounded-lg bg-card p-2 border">
                  <span className="text-muted-foreground block text-[10px]">DESTINATION AREA</span>
                  <span className="text-foreground text-sm font-bold">
                    {routeAnalysis.destination.length} within {radiusM} m
                  </span>
                </div>
              </div>

              {/* Approximate & Imprecise notes */}
              {routeAnalysis.approximateNearby.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  • {routeAnalysis.approximateNearby.length} nearby reports have only approximate locations.
                </p>
              )}
              {routeAnalysis.imprecise.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  • {routeAnalysis.imprecise.length} reports in this region have no precise location.
                </p>
              )}

              {/* Radius slider */}
              <div className="border-t pt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Radius sensitivity:</span>
                  <span className="font-semibold">{radiusM} m</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1000"
                  step="50"
                  value={radiusM}
                  onChange={(e) => setRadiusM(Number(e.target.value))}
                  className="mt-1 w-full accent-primary"
                  aria-label="Route analysis radius slider"
                />
              </div>
            </div>

            {/* Most Recent Report */}
            {routeAnalysis.mostRecent && (
              <div className="mt-3 rounded-xl border bg-card p-3 text-xs">
                <p className="font-semibold text-foreground">MOST RECENT REPORT NEAR ROUTE</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={routeAnalysis.mostRecent.category as Category} />
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                    {routeAnalysis.mostRecent.publication_status}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">Incident Date</dt>
                    <dd className="font-medium text-foreground">
                      {routeAnalysis.mostRecent.incident_occurred_at ?? "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Publication Date</dt>
                    <dd className="font-medium text-foreground">
                      {routeAnalysis.mostRecent.source_published_at
                        ? new Date(routeAnalysis.mostRecent.source_published_at).toLocaleDateString("en-GB")
                        : "Unknown"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-1.5 text-muted-foreground">
                  Source: <strong className="text-foreground">{routeAnalysis.mostRecent.source_name ?? "Community report"}</strong>
                </p>
                {routeAnalysis.mostRecent.source_url && (
                  <a
                    href={routeAnalysis.mostRecent.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-primary underline"
                  >
                    Original source <ExternalLink className="size-3" />
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedId(routeAnalysis.mostRecent!.id)}
                  className="mt-2 w-full text-xs"
                >
                  View Details in Incident Drawer
                </Button>
              </div>
            )}

            {/* Standard Safety Disclaimers */}
            <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                {lastUpdate ? `Last updated ${new Date(lastUpdate).toLocaleDateString("en-GB")}. ` : ""}
                {isStale && <strong className="text-amber-600 dark:text-amber-400">Data may be out of date. </strong>}
              </p>
              <p>
                These results reflect available published reports. Missing reports do not mean an area is safe.
              </p>
            </div>
          </aside>
        )}

        {/* ── INCIDENT DETAIL DRAWER (Desktop right side, Mobile bottom sheet) ── */}
        {selected && !activeRoute && (
          <IncidentDrawer incident={selected} onClose={() => setSelectedId(null)} />
        )}

        {/* ── MAP LOADING / ERROR / EMPTY OVERLAYS ── */}
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-5 shadow-float">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Loading reports…</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="pointer-events-auto absolute inset-x-4 top-24 z-30 mx-auto max-w-sm rounded-2xl border bg-card p-4 shadow-float">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Failed to load reports</p>
                <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
                <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-2 text-xs">
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="pointer-events-auto absolute inset-x-4 top-24 z-20 mx-auto max-w-sm rounded-2xl border bg-card p-4 shadow-float">
            <p className="text-sm font-semibold">No reports match these filters.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A lack of reports does not mean an area is safe. Many incidents are never reported.
            </p>
          </div>
        )}
      </div>

      {/* ── FULL LIST VIEW OVERLAY (When List mode toggled) ── */}
      {viewMode === "list" && (
        <div className="absolute inset-0 z-30 overflow-y-auto bg-background/95 p-4 backdrop-blur-md md:p-8">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between pb-4">
              <div>
                <h2 className="text-xl font-bold">Reports in this view</h2>
                <p className="text-xs text-muted-foreground">Sorted by incident date</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setViewMode("map")}>
                <MapIcon className="mr-1.5 size-4" /> Back to Map
              </Button>
            </div>

            {sortedForList.length === 0 ? (
              <div className="rounded-2xl border bg-card p-6 text-center text-sm">
                <p className="font-semibold">No reports match these filters.</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  A lack of reports does not mean an area is safe.
                </p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="Reports in this view">
                {sortedForList.map((item) => (
                  <button
                    key={item.id}
                    role="listitem"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(item.id);
                      setViewMode("map");
                      if (item.lat != null && item.lng != null) {
                        setFlyTo({ lat: item.lat, lng: item.lng, zoom: 14, key: Date.now() });
                      }
                    }}
                    className="w-full rounded-2xl border bg-card p-4 text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <CategoryBadge category={item.category} />
                      <span className="text-xs text-muted-foreground">
                        {formatWindow(item.date_from, item.date_to)}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold text-sm">{item.area_label}</p>
                    {item.summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FILTERS DIALOG ── */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Filter Incident Reports</DialogTitle>
            <DialogDescription>Select categories and timeframes to adjust map and list.</DialogDescription>
          </DialogHeader>
          {filterPanel}
          <Button onClick={() => setShowFilters(false)} className="mt-4 w-full">
            Apply Filters ({filtered.length} reports)
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SUBCOMPONENTS ─────────────────────────────────────────────────────────────

export function PlaceSearch({
  onPick,
  placeholder = "Search area, road or landmark in Bangladesh",
}: {
  onPick: (p: { label: string; lat: number; lng: number }) => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState("");
  return (
    <PlaceCombobox
      value={val}
      onChange={setVal}
      onPick={(p) => onPick({ label: p.name, lat: p.lat, lng: p.lng })}
      placeholder={placeholder}
    />
  );
}


// ── INCIDENT DRAWER (Right-side on Desktop, Bottom sheet on Mobile <768px) ──

function IncidentDrawer({
  incident,
  onClose,
}: {
  incident: PublishedIncident;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [flagOpen, setFlagOpen] = useState(false);

  async function savePlace() {
    if (!session) {
      toast("Sign in to save places privately.");
      return;
    }
    const { error } = await supabase.from("saved_places").insert({
      user_id: session.user.id,
      label: incident.area_label.replace(/^Near /, ""),
      lat: incident.lat,
      lng: incident.lng,
    });
    if (error) {
      toast.error("Couldn't save this place.");
      return;
    }
    toast.success("Saved privately to your profile.");
  }

  return (
    <section
      aria-label="Incident details"
      className="absolute bottom-0 right-0 z-20 max-h-[75vh] w-full overflow-y-auto rounded-t-3xl border-t bg-card/98 p-5 shadow-float backdrop-blur-md md:bottom-4 md:right-4 md:max-h-[calc(100vh-2rem)] md:w-96 md:rounded-3xl md:border"
    >
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border md:hidden" />

      <div className="flex items-start justify-between gap-3">
        <CategoryBadge category={incident.category} />
        <button
          onClick={onClose}
          aria-label="Close details"
          className="grid size-8 place-items-center rounded-full hover:bg-muted text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <h2 className="mt-3 text-lg font-bold text-foreground">{incident.area_label || "Unknown location"}</h2>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ReportTypeBadge type={incident.report_type} />
        <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-[11px] font-medium text-foreground">
          <ShieldCheck className="size-3" /> Reviewed by moderators
        </span>
        {incident.is_sample && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            Sample data
          </span>
        )}
      </div>

      {/* Dates and source details (with 'Unknown' fallbacks) */}
      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-xs">
        <div>
          <dt className="text-muted-foreground font-semibold">Incident date</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {formatWindow(incident.date_from, incident.date_to) || "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">Publication date</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {incident.published_at
              ? new Date(incident.published_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">Source name</dt>
          <dd className="mt-0.5 font-medium text-foreground">{reportTypeLabel(incident.report_type)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">Status</dt>
          <dd className="mt-0.5 font-medium text-foreground">Published</dd>
        </div>
      </dl>

      {/* Summary */}
      <div className="mt-3 text-xs leading-relaxed text-foreground">
        {incident.summary ? (
          <p>{incident.summary}</p>
        ) : (
          <p className="text-muted-foreground italic">No summary provided for this report.</p>
        )}
      </div>

      {/* Privacy note */}
      <p className="mt-3 rounded-xl bg-muted p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Moderators checked this report for privacy and safety. That does not mean it has been proven. {DISCLAIMER}
      </p>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={savePlace}>
          <Bookmark className="mr-1.5 size-3.5" /> Save place
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => (session ? setFlagOpen(true) : toast("Sign in to flag or correct a report."))}
        >
          <Flag className="mr-1.5 size-3.5" /> Flag / correct
        </Button>
      </div>

      <Link
        to="/support"
        className="mt-3 flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium hover:bg-muted"
      >
        <span className="flex items-center gap-2">
          <LifeBuoy className="size-3.5 text-primary" /> Need support? See help contacts
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground" />
      </Link>

      <FlagDialog open={flagOpen} onOpenChange={setFlagOpen} incidentId={incident.id} />
    </section>
  );
}

// ── FLAG REPORT DIALOG ────────────────────────────────────────────────────────

const FLAG_REASONS = [
  { value: "inaccurate", label: "Something is inaccurate" },
  { value: "identifies_someone", label: "It could identify someone" },
  { value: "duplicate", label: "It duplicates another report" },
  { value: "harmful", label: "It is harmful or abusive" },
  { value: "other", label: "Something else" },
] as const;

function FlagDialog({
  open,
  onOpenChange,
  incidentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  incidentId: string;
}) {
  const { session } = useAuth();
  const [reason, setReason] = useState<(typeof FLAG_REASONS)[number]["value"]>("inaccurate");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from("incident_flags").insert({
      published_id: incidentId,
      user_id: session.user.id,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't send your flag. Please try again.");
      return;
    }
    toast.success("Thank you. A moderator will review this privately.");
    setDetails("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag or correct this report</DialogTitle>
          <DialogDescription>Only moderators will see this. Please don't include names or contact details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {FLAG_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary"
            >
              <input
                type="radio"
                name="reason"
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-primary"
              />
              {r.label}
            </label>
          ))}
        </div>
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
          placeholder="Optional details"
          rows={3}
        />
        <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send privately"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
