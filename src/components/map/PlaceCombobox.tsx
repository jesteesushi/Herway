import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { Search, X, LocateFixed, Navigation, Clock, Loader2 } from "lucide-react";
import { usePlaceSearch, type Place } from "@/hooks/use-place-search";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RECENT_KEY = "herway-recent-places";

function getRecentPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentPlace(place: Place) {
  try {
    const existing = getRecentPlaces().filter(
      (p) => !(p.lat === place.lat && p.lng === place.lng && p.name === place.name),
    );
    const updated = [place, ...existing].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
}

export type PlaceComboboxProps = {
  value: string;
  onChange: (v: string) => void;
  onPick: (place: Place) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  onPickMap?: () => void;
  isPicking?: boolean;
  showUseMyLocation?: boolean;
  centerBias?: { lat: number; lng: number };
  className?: string;
};

export function PlaceCombobox({
  value,
  onChange,
  onPick,
  onClear,
  placeholder = "Search area, road or landmark in Bangladesh",
  label,
  onPickMap,
  isPicking = false,
  showUseMyLocation = false,
  centerBias,
  className,
}: PlaceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<Place[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading, error } = usePlaceSearch(value, centerBias);

  useEffect(() => {
    setRecent(getRecentPlaces());
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showRecent = open && value.trim().length < 2 && recent.length > 0;
  const showResults = open && value.trim().length >= 2;
  const items = showResults ? results : showRecent ? recent : [];

  function handleSelect(place: Place) {
    saveRecentPlace(place);
    setRecent(getRecentPlaces());
    onPick(place);
    onChange(place.name);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        handleSelect(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    toast("Getting your current location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const place: Place = {
          name: "My current location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        handleSelect(place);
        toast.success("Location set");
      },
      (err) => {
        toast.error("Could not get your location: " + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-1.5">
        {label && <span className="w-9 text-[11px] font-semibold text-muted-foreground">{label}</span>}
        <div className="relative flex-1">
          {!label && (
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-activedescendant={activeIndex >= 0 ? `place-item-${activeIndex}` : undefined}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "w-full rounded-xl border bg-background text-xs outline-none focus:ring-2 focus:ring-primary",
              label ? "h-9 pl-2.5 pr-7" : "h-10 pl-9 pr-8",
            )}
          />

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                onClear?.();
                setOpen(false);
                inputRef.current?.focus();
              }}
              aria-label="Clear field"
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
                label ? "right-2" : "right-2.5",
              )}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Use my location button (From field only) */}
        {showUseMyLocation && (
          <button
            type="button"
            onClick={handleUseMyLocation}
            title="Use my location"
            aria-label="Use my location"
            className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <Navigation className="size-4" />
          </button>
        )}

        {/* Pick on map button */}
        {onPickMap && (
          <button
            type="button"
            onClick={onPickMap}
            title="Pick on map"
            aria-label={`Pick ${label ?? "location"} on map`}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg border transition",
              isPicking
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <LocateFixed className="size-4" />
          </button>
        )}
      </div>

      {/* Dropdown list */}
      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full mt-1.5 z-40 max-h-56 overflow-y-auto rounded-xl border bg-popover p-1 shadow-float"
        >
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-1 p-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Loader2 className="size-3 animate-spin text-primary" /> Searching places…
              </div>
              <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
              <div className="h-4 rounded bg-muted animate-pulse w-1/2" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="p-3 text-center text-xs text-destructive">{error}</div>
          )}

          {/* No results */}
          {!loading && !error && showResults && results.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No places found in Bangladesh.
            </div>
          )}

          {/* Recent searches header */}
          {showRecent && (
            <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3" /> Recent searches
            </div>
          )}

          {/* List items */}
          {!loading &&
            items.map((place, idx) => (
              <button
                key={`${place.lat}-${place.lng}-${idx}`}
                id={`place-item-${idx}`}
                role="option"
                aria-selected={activeIndex === idx}
                type="button"
                className={cn(
                  "w-full rounded-lg px-2.5 py-2 text-left text-xs transition flex items-center justify-between",
                  activeIndex === idx ? "bg-muted text-foreground" : "hover:bg-muted/80 text-foreground",
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(place)}
              >
                <span className="truncate">{place.name}</span>
                {showRecent && <Clock className="size-3 text-muted-foreground shrink-0 ml-2" />}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
