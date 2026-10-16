import { useEffect, useRef } from "react";
import { maplibregl } from "./setup";
import { CATEGORY_HEX, BD_CENTER, type PublishedIncident } from "@/lib/herway";

// Free, key-less basemaps — Carto Positron (light) and Dark Matter (dark).
const STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

function getTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

type Props = {
  incidents: PublishedIncident[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  flyTo: { lat: number; lng: number; zoom?: number; key: number } | null;
  onViewChange?: (visibleIds: string[], center: { lat: number; lng: number }) => void;
  routeCoordinates?: [number, number][] | null;
  fitRouteTrigger?: number;
  pickingLocation?: boolean;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
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
  onViewChange,
  routeCoordinates,
  fitRouteTrigger,
  pickingLocation,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const latest = useRef({ incidents, onSelect, onViewChange, onMapClick, routeCoordinates, pickingLocation });
  latest.current = { incidents, onSelect, onViewChange, onMapClick, routeCoordinates, pickingLocation };

  function reportView(map: maplibregl.Map) {
    const b = map.getBounds();
    const ids = latest.current.incidents
      .filter((i) => i.lat != null && i.lng != null && b.contains([i.lng, i.lat]))
      .map((i) => i.id);
    const c = map.getCenter();
    latest.current.onViewChange?.(ids, { lat: c.lat, lng: c.lng });
  }

  function addRouteLayers(map: maplibregl.Map) {
    if (map.getSource("route")) return;

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
      "clusters", // beneath markers
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
      "clusters",
    );
  }

  function addLayers(map: maplibregl.Map) {
    if (!map.getSource("incidents")) {
      map.addSource("incidents", {
        type: "geojson",
        data: toGeoJSON(latest.current.incidents),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14, // street-level marker separation
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

      // Individual incident circles
      map.addLayer({
        id: "points",
        type: "circle",
        source: "incidents",
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

    addRouteLayers(map);

    readyRef.current = true;
    reportView(map);
  }

  // Mount map once
  useEffect(() => {
    if (!containerRef.current) return;
    const theme = getTheme();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[theme],
      center: BD_CENTER,
      zoom: 6.3,
      minZoom: 5.5,
      maxZoom: 19, // supports street level zoom
      maxBounds: [
        [86.5, 20.0],
        [94.0, 27.2],
      ],
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => addLayers(map));
    map.on("moveend", () => readyRef.current && reportView(map));

    map.on("click", "clusters", async (e: any) => {
      if (latest.current.pickingLocation) return;
      const f = e.features?.[0];
      if (!f) return;
      const src = map.getSource("incidents") as maplibregl.GeoJSONSource;
      const zoom = await src.getClusterExpansionZoom(f.properties?.["cluster_id"] as number);
      map.easeTo({ center: (f.geometry as any).coordinates as [number, number], zoom: zoom + 0.3 });
    });

    map.on("click", "points", (e: any) => {
      if (latest.current.pickingLocation) return;
      const id = e.features?.[0]?.properties?.["id"] as string | undefined;
      if (id) latest.current.onSelect(id);
    });

    map.on("click", (e: any) => {
      if (latest.current.pickingLocation) {
        latest.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        return;
      }
      const hits = map.queryRenderedFeatures(e.point, { layers: ["points", "clusters"] });
      if (!hits.length) latest.current.onSelect(null);
    });

    for (const l of ["clusters", "points"]) {
      map.on("mouseenter", l, () => {
        if (!latest.current.pickingLocation) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", l, () => {
        if (!latest.current.pickingLocation) map.getCanvas().style.cursor = "";
      });
    }

    // Resize safety net: ResizeObserver ensures map adjusts to layout changes and hydration
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(containerRef.current);

    // React to theme toggle dispatched by ThemeToggle component
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent<"light" | "dark">).detail;
      map.setStyle(STYLES[detail]);
      map.once("style.load", () => {
        addLayers(map);
      });
    };
    window.addEventListener("herway-theme", onThemeChange);

    return () => {
      ro.disconnect();
      window.removeEventListener("herway-theme", onThemeChange);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update cursor on pick mode change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickingLocation ? "crosshair" : "";
  }, [pickingLocation]);

  // Update incident markers when filtered incidents change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("incidents") as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(incidents));
    const b = map.getBounds();
    const c = map.getCenter();
    onViewChange?.(
      incidents.filter((i) => i.lat != null && i.lng != null && b.contains([i.lng, i.lat])).map((i) => i.id),
      { lat: c.lat, lng: c.lng },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

  // Update route line when route coordinates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
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
  }, [routeCoordinates]);

  // Fit route trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeCoordinates || routeCoordinates.length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    routeCoordinates.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
  }, [fitRouteTrigger]);

  // Update selected pin highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
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
  }, [selectedId]);

  // Fly to searched place
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
    </div>
  );
}
