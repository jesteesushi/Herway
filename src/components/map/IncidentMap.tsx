import { useEffect, useRef, useState } from "react";
import { maplibregl } from "./setup";
import { CATEGORY_HEX, BD_CENTER, type PublishedIncident } from "@/lib/herway";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const BASEMAPS = {
  standard: "https://tiles.openfreemap.org/styles/liberty", // roads, POIs, labels, buildings
  light: "https://tiles.openfreemap.org/styles/positron", // quiet background for incident focus
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export type BasemapChoice = "standard" | "light" | "dark" | "auto";

function getEffectiveStyle(choice: BasemapChoice): string {
  if (choice === "auto") {
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark";
    return isDark ? BASEMAPS.dark : BASEMAPS.standard;
  }
  return BASEMAPS[choice];
}

type Props = {
  incidents: PublishedIncident[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  flyTo: { lat: number; lng: number; zoom?: number; key: number } | null;
  searchMarker?: { lat: number; lng: number; label?: string } | null;
  onViewChange?: (visibleIds: string[], center: { lat: number; lng: number }) => void;
  routeCoordinates?: [number, number][] | null;
  fitRouteTrigger?: number;
  pickingLocation?: boolean;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  basemap?: BasemapChoice;
  showIncidents?: boolean;
  showHelpPoints?: boolean;
  show3DBuildings?: boolean;
  showTransit?: boolean;
  showLabels?: boolean;
};

function toGeoJSON(items: PublishedIncident[]) {
  return {
    type: "FeatureCollection" as const,
    features: items
      .filter((i) => i.lat != null && i.lng != null)
      .map((i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [i.lng, i.lat] as [number, number] },
        properties: { id: i.id, category: i.category },
      })),
  };
}

function categoryColorExpr(): any[] {
  const pairs = Object.entries(CATEGORY_HEX).flat();
  return ["match", ["get", "category"], ...pairs, "#56666E"];
}

export default function IncidentMap({
  incidents,
  selectedId,
  onSelect,
  flyTo,
  searchMarker,
  onViewChange,
  routeCoordinates,
  fitRouteTrigger,
  pickingLocation,
  onMapClick,
  basemap = "auto",
  showIncidents = true,
  showHelpPoints = false,
  show3DBuildings = false,
  showTransit = true,
  showLabels = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);

  const latest = useRef({
    incidents,
    onSelect,
    onViewChange,
    onMapClick,
    routeCoordinates,
    pickingLocation,
    showIncidents,
    showHelpPoints,
    show3DBuildings,
    showTransit,
    showLabels,
  });
  latest.current = {
    incidents,
    onSelect,
    onViewChange,
    onMapClick,
    routeCoordinates,
    pickingLocation,
    showIncidents,
    showHelpPoints,
    show3DBuildings,
    showTransit,
    showLabels,
  };

  const lastReported = useRef<{ ids: string; lat: number; lng: number }>({ ids: "", lat: 0, lng: 0 });

  function reportView(map: maplibregl.Map) {
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    const ids = latest.current.incidents
      .filter((i) => i.lat != null && i.lng != null && b.contains([i.lng, i.lat]))
      .map((i) => i.id);
    const c = map.getCenter();
    const idsKey = ids.join(",");
    if (
      lastReported.current.ids === idsKey &&
      Math.abs(lastReported.current.lat - c.lat) < 0.0001 &&
      Math.abs(lastReported.current.lng - c.lng) < 0.0001
    ) {
      return;
    }
    lastReported.current = { ids: idsKey, lat: c.lat, lng: c.lng };
    latest.current.onViewChange?.(ids, { lat: c.lat, lng: c.lng });
  }

  function addRouteLayers(map: maplibregl.Map) {
    if (!map.getSource("route")) {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: latest.current.routeCoordinates ?? [],
          },
        },
      });

      map.addLayer(
        {
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 7,
            "line-opacity": 0.85,
          },
        },
        map.getLayer("clusters") ? "clusters" : undefined,
      );

      map.addLayer(
        {
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#2563eb",
            "line-width": 4.5,
            "line-opacity": 0.95,
          },
        },
        map.getLayer("clusters") ? "clusters" : undefined,
      );
    }
  }

  function addAllLayers(map: maplibregl.Map) {
    if (!map || !map.getStyle()) return;

    // 1. Incidents GeoJSON source
    if (!map.getSource("incidents")) {
      map.addSource("incidents", {
        type: "geojson",
        data: toGeoJSON(latest.current.incidents),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 13,
      });

      // Cluster circles
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "incidents",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#24434c",
          "circle-opacity": 0.88,
          "circle-stroke-color": "#fbf8f1",
          "circle-stroke-width": 2.5,
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 21, 15, 27],
        },
      });

      // Cluster count labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "incidents",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
          "text-font": ["Noto Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: { "text-color": "#fbf8f1" },
      });

      // Approximate area circles (Phase 3c: zoom >= 14.5)
      map.addLayer({
        id: "incident-areas",
        type: "circle",
        source: "incidents",
        minzoom: 14.5,
        filter: ["!", ["has", "point_count"]],
        paint: {
          // ~150 m radius at Bangladesh latitudes (px = 8.6 * 2^(zoom-12))
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 12, 8.6, 19, 1100],
          "circle-color": [
            "match",
            ["get", "category"],
            "harassment",
            "#b8457f",
            "stalking",
            "#7452c2",
            "sexual_assault",
            "#1f7a84",
            "#86687a",
          ],
          "circle-opacity": 0.18,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": [
            "match",
            ["get", "category"],
            "harassment",
            "#b8457f",
            "stalking",
            "#7452c2",
            "sexual_assault",
            "#1f7a84",
            "#86687a",
          ],
        },
      });

      // Individual incident pins (zoom < 14.5)
      map.addLayer({
        id: "points",
        type: "circle",
        source: "incidents",
        maxzoom: 14.5,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 8,
          "circle-color": categoryColorExpr(),
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": ["case", ["==", ["get", "id"], selectedId ?? ""], 1, 0.7],
          "circle-opacity": ["case", ["==", ["get", "id"], selectedId ?? ""], 1, 0.82],
        },
      });
    }

    // 2. Help points POI layer (police stations, hospitals, pharmacies) from openmaptiles
    if (map.getSource("openmaptiles") && !map.getLayer("help-points")) {
      map.addLayer({
        id: "help-points",
        type: "circle",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 12,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["police", "hospital", "pharmacy", "clinic", "doctors"]],
        ],
        layout: {
          visibility: latest.current.showHelpPoints ? "visible" : "none",
        },
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "class"],
            "police",
            "#1d4ed8",
            "hospital",
            "#dc2626",
            "#059669",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    // 3. 3D Buildings
    const has3DLayer = map.getLayer("building-3d");
    if (!has3DLayer && map.getSource("openmaptiles")) {
      map.addLayer({
        id: "building-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        layout: {
          visibility: latest.current.show3DBuildings ? "visible" : "none",
        },
        paint: {
          "fill-extrusion-color": "#d1d5db",
          "fill-extrusion-height": ["get", "render_height"],
          "fill-extrusion-base": ["get", "render_min_height"],
          "fill-extrusion-opacity": 0.8,
        },
      });
    }

    // 4. Route layers
    addRouteLayers(map);
  }

  function initMap() {
    if (!containerRef.current) return;
    setMapError(false);
    setMapLoaded(false);

    const initialStyle = getEffectiveStyle(basemap);

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle,
        center: BD_CENTER,
        zoom: 6.3,
        minZoom: 5.5,
        maxZoom: 19,
        hash: "map",
        maxBounds: [
          [84.0, 18.5],
          [96.0, 28.5],
        ],
        attributionControl: false,
      });
      mapRef.current = map;

      // Controls (Phase 3a #4, #11)
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: "© OpenStreetMap contributors, OpenFreeMap & CARTO",
        }),
        "bottom-right",
      );

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }),
        "bottom-right",
      );

      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

      map.addControl(new maplibregl.FullscreenControl(), "bottom-right");

      // GeolocateControl only on secure contexts (HTTPS/localhost)
      if (typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost")) {
        map.addControl(
          new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
          }),
          "bottom-right",
        );
      }

      map.on("load", () => {
        addAllLayers(map);
        setMapLoaded(true);
        reportView(map);
      });

      map.on("style.load", () => {
        addAllLayers(map);
      });

      map.on("error", (e: any) => {
        if (e?.dataType === "style") {
          setMapError(true);
        }
      });

      map.on("moveend", () => reportView(map));

      // Click clusters
      map.on("click", "clusters", async (e: any) => {
        if (latest.current.pickingLocation) return;
        const f = e.features?.[0];
        if (!f) return;
        const src = map.getSource("incidents") as maplibregl.GeoJSONSource;
        const zoom = await src.getClusterExpansionZoom(f.properties?.["cluster_id"] as number);
        map.easeTo({ center: (f.geometry as any).coordinates as [number, number], zoom: zoom + 0.3 });
      });

      // Click pins & area circles
      const onPinClick = (e: any) => {
        if (latest.current.pickingLocation) return;
        const id = e.features?.[0]?.properties?.["id"] as string | undefined;
        if (id) latest.current.onSelect(id);
      };
      map.on("click", "points", onPinClick);
      map.on("click", "incident-areas", onPinClick);

      // Map canvas click
      map.on("click", (e: any) => {
        if (latest.current.pickingLocation) {
          latest.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          return;
        }
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ["points", "clusters", "incident-areas"],
        });
        if (!hits.length) latest.current.onSelect(null);
      });

      for (const l of ["clusters", "points", "incident-areas"]) {
        map.on("mouseenter", l, () => {
          if (!latest.current.pickingLocation) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", l, () => {
          if (!latest.current.pickingLocation) map.getCanvas().style.cursor = "";
        });
      }
    } catch {
      setMapError(true);
    }
  }

  // Mount map once
  useEffect(() => {
    initMap();

    const ro = new ResizeObserver(() => mapRef.current?.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    // Theme listener for Auto basemap
    const onThemeChange = () => {
      const map = mapRef.current;
      if (map && basemap === "auto") {
        const style = getEffectiveStyle("auto");
        map.setStyle(style);
      }
    };
    window.addEventListener("herway-theme", onThemeChange);

    return () => {
      ro.disconnect();
      window.removeEventListener("herway-theme", onThemeChange);
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update style when basemap prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const style = getEffectiveStyle(basemap);
    map.setStyle(style);
  }, [basemap, mapLoaded]);

  // Update 3D buildings and pitch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (map.getLayer("building-3d")) {
      map.setLayoutProperty("building-3d", "visibility", show3DBuildings ? "visible" : "none");
    }
    map.easeTo({ pitch: show3DBuildings ? 55 : 0, duration: 600 });
  }, [show3DBuildings, mapLoaded]);

  // Update Help points visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (map.getLayer("help-points")) {
      map.setLayoutProperty("help-points", "visibility", showHelpPoints ? "visible" : "none");
    }
  }, [showHelpPoints, mapLoaded]);

  // Update Incidents layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = showIncidents ? "visible" : "none";
    for (const l of ["clusters", "cluster-count", "incident-areas", "points"]) {
      if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
    }
  }, [showIncidents, mapLoaded]);

  // Update Transit layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const style = map.getStyle();
    if (!style) return;
    const transitLayers = style.layers.filter(
      (l) => l.id.includes("transit") || l["source-layer"] === "transportation",
    );
    for (const l of transitLayers) {
      if (map.getLayer(l.id)) {
        map.setLayoutProperty(l.id, "visibility", showTransit ? "visible" : "none");
      }
    }
  }, [showTransit, mapLoaded]);

  // Update Labels visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const style = map.getStyle();
    if (!style) return;
    const symbolLayers = style.layers.filter(
      (l) => l.type === "symbol" && l.id !== "cluster-count",
    );
    for (const l of symbolLayers) {
      if (map.getLayer(l.id)) {
        map.setLayoutProperty(l.id, "visibility", showLabels ? "visible" : "none");
      }
    }
  }, [showLabels, mapLoaded]);

  // Search result marker + flyTo (Phase 3a #6)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (searchMarker) {
      if (!searchMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "size-6 rounded-full bg-primary border-2 border-white shadow-float flex items-center justify-center text-primary-foreground";
        el.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
        searchMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([searchMarker.lng, searchMarker.lat])
          .addTo(map);
      } else {
        searchMarkerRef.current.setLngLat([searchMarker.lng, searchMarker.lat]);
      }
    } else if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
  }, [searchMarker]);

  // Cursor on pickingLocation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickingLocation ? "crosshair" : "";
  }, [pickingLocation]);

  // Update incidents data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource("incidents") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(toGeoJSON(incidents));
    }
  }, [incidents, mapLoaded]);

  // Update route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeCoordinates ?? [],
      },
    };
    if (src) {
      src.setData(data as any);
    } else if (routeCoordinates && routeCoordinates.length >= 2) {
      addRouteLayers(map);
    }
  }, [routeCoordinates, mapLoaded]);

  // Fit route trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeCoordinates || routeCoordinates.length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    routeCoordinates.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
  }, [fitRouteTrigger]);

  // Selected pin highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer("points")) return;
    map.setPaintProperty("points", "circle-stroke-opacity", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      1,
      0.7,
    ]);
    map.setPaintProperty("points", "circle-opacity", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      1,
      0.82,
    ]);
  }, [selectedId, mapLoaded]);

  // Fly to target
  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 14, speed: 1.4 });
    }
  }, [flyTo]);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="h-full w-full"
        aria-label="Map of community-reported incidents in Bangladesh"
        role="region"
      />

      {/* Loading skeleton until map 'load' fires */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card/90 p-4 shadow-float">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Loading map…</p>
          </div>
        </div>
      )}

      {/* Map error state with Retry button (Phase 3a #9) */}
      {mapError && (
        <div className="absolute inset-x-4 top-24 z-30 mx-auto max-w-sm rounded-2xl border border-destructive/30 bg-card p-5 shadow-float">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold text-sm">The map could not be loaded</p>
              <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  mapRef.current?.remove();
                  mapRef.current = null;
                  initMap();
                }}
                className="mt-3 text-xs"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
