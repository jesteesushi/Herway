import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";

const IncidentMapLazy = lazy(() => import("./map/IncidentMap"));
const LocationPickerLazy = lazy(() => import("./map/LocationPicker"));

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const Fallback = () => (
  <div className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground">Loading map…</div>
);

export function IncidentMap(props: ComponentProps<typeof IncidentMapLazy>) {
  const mounted = useMounted();
  if (!mounted) return <Fallback />;
  return (
    <Suspense fallback={<Fallback />}>
      <IncidentMapLazy {...props} />
    </Suspense>
  );
}

export function LocationPicker(props: ComponentProps<typeof LocationPickerLazy>) {
  const mounted = useMounted();
  if (!mounted) return <Fallback />;
  return (
    <Suspense fallback={<Fallback />}>
      <LocationPickerLazy {...props} />
    </Suspense>
  );
}
