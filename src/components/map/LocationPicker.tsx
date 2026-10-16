import { useEffect, useRef } from "react";
import { maplibregl } from "./setup";
import { BD_CENTER, MAP_STYLE } from "@/lib/herway";

type Point = { lat: number; lng: number };
type Props = {
  value: Point | null;
  onChange?: (p: Point) => void;
  secondary?: Point | null; // e.g. proposed public location in moderation
  center?: Point | null;
};

export default function LocationPicker({ value, onChange, secondary, center }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const marker2 = useRef<maplibregl.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!ref.current) return;
    const start = value ?? center;
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE,
      center: start ? [start.lng, start.lat] : BD_CENTER,
      zoom: start ? 13 : 6.3,
      maxBounds: [
        [86.5, 20.0],
        [94.0, 27.2],
      ],
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    if (cb.current) {
      map.on("click", (e: any) => cb.current?.({ lat: Number(e.lngLat.lat.toFixed(5)), lng: Number(e.lngLat.lng.toFixed(5)) }));
      map.getCanvas().style.cursor = "crosshair";
    }
    mapRef.current = map;
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value) {
      if (!marker.current) marker.current = new maplibregl.Marker({ color: "#24434c" }).setLngLat([value.lng, value.lat]).addTo(map);
      else marker.current.setLngLat([value.lng, value.lat]);
    }
  }, [value]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !secondary) return;
    if (!marker2.current) marker2.current = new maplibregl.Marker({ color: "#c0794f" }).setLngLat([secondary.lng, secondary.lat]).addTo(map);
    else marker2.current.setLngLat([secondary.lng, secondary.lat]);
  }, [secondary]);

  useEffect(() => {
    if (center && mapRef.current) mapRef.current.flyTo({ center: [center.lng, center.lat], zoom: 14 });
  }, [center]);

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
