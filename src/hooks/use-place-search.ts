import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Place = { name: string; lat: number; lng: number };

// Module-level in-memory cache (cleared on page reload)
const cache = new Map<string, Place[]>();

export function usePlaceSearch(
  query: string,
  bias?: { lat: number; lng: number },
) {
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current; // invalidates older in-flight requests
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = q.toLowerCase();
    const hit = cache.get(cacheKey);
    if (hit) {
      setResults(hit);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const t = setTimeout(async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("nav", {
          body: { action: "geocode", q, ...(bias ?? { lat: 23.8, lng: 90.4 }) },
        });

        if (id !== seq.current) return; // stale — ignore

        setLoading(false);

        if (fnError || data?.error) {
          setError("Search is unavailable right now. Please try again.");
          return;
        }

        const places: Place[] = data?.results ?? [];
        cache.set(cacheKey, places);
        setResults(places);
        setError(null);
      } catch {
        if (id !== seq.current) return;
        setLoading(false);
        setError("Search is unavailable right now. Please try again.");
      }
    }, 300); // 300 ms debounce

    return () => clearTimeout(t);
    // bias is intentionally excluded — stale closure values are acceptable here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { results, loading, error };
}
