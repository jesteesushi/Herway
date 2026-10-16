import { describe, expect, it } from "vitest";
import { analyzeRoute, type LngLat, type PublicIncident } from "@/lib/routeAnalysis";

describe("Route safety analysis (analyzeRoute)", () => {
  // A straight route in Dhaka from [90.4000, 23.7500] to [90.4000, 23.7600]
  // Note: 1 degree latitude is ~111,000 meters. 0.00045 deg lat ~ 50 meters.
  // 0.009 deg lat ~ 1,000 meters (1 km).
  const route: LngLat[] = [
    [90.4000, 23.7500],
    [90.4000, 23.7600],
  ];

  it("includes an exact point 50m from the route in corridor", () => {
    // Point at same lat midway, shifted slightly in longitude (~50m)
    // At lat 23.75, 1 deg lon is ~101,800m. 50m / 101800 ~ 0.00049 deg lon.
    const closeIncident: PublicIncident = {
      id: "inc-close-1",
      category: "harassment",
      source_name: "Community",
      source_url: "https://example.com/1",
      latitude: 23.7550,
      longitude: 90.40045, // ~45m offset from route line
      location_precision: "exact",
      incident_occurred_at: "2026-10-01",
      source_published_at: "2026-10-02",
      publication_status: "published",
      summary: "Incident near roadway",
      district: "Dhaka",
    };

    const res = analyzeRoute(route, [closeIncident], { corridor_m: 200, radius_m: 500 });
    expect(res.corridor.map((i) => i.id)).toContain("inc-close-1");
  });

  it("excludes an exact point 1km away from corridor and endpoints", () => {
    // Point shifted by ~0.01 deg in longitude (~1,000m / 1km away)
    const farIncident: PublicIncident = {
      id: "inc-far-1",
      category: "harassment",
      source_name: "Community",
      source_url: "https://example.com/2",
      latitude: 23.7550,
      longitude: 90.4100, // ~1,000m away
      location_precision: "exact",
      incident_occurred_at: "2026-10-01",
      source_published_at: "2026-10-02",
      publication_status: "published",
      summary: "Incident far away",
      district: "Dhaka",
    };

    const res = analyzeRoute(route, [farIncident], { corridor_m: 200, radius_m: 500 });
    expect(res.corridor).toHaveLength(0);
    expect(res.origin).toHaveLength(0);
    expect(res.destination).toHaveLength(0);
    expect(res.approximateNearby).toHaveLength(0);
  });

  it("places district-level or null coordinate records only in imprecise", () => {
    const districtIncident: PublicIncident = {
      id: "inc-dist-1",
      category: "harassment",
      source_name: "News",
      source_url: "https://example.com/3",
      latitude: 23.7550,
      longitude: 90.4000, // right on the route, but district precision
      location_precision: "district",
      incident_occurred_at: "2026-09-15",
      source_published_at: "2026-09-16",
      publication_status: "published",
      summary: "Reported somewhere in Dhaka district",
      district: "Dhaka",
    };

    const nullCoordsIncident: PublicIncident = {
      id: "inc-null-1",
      category: "stalking",
      source_name: "News",
      source_url: "https://example.com/4",
      latitude: null,
      longitude: null,
      location_precision: "unknown",
      incident_occurred_at: "2026-09-10",
      source_published_at: "2026-09-11",
      publication_status: "published",
      summary: "No coordinates known",
      district: "Chittagong",
    };

    const res = analyzeRoute(route, [districtIncident, nullCoordsIncident], { corridor_m: 200, radius_m: 500 });
    expect(res.corridor).toHaveLength(0);
    expect(res.origin).toHaveLength(0);
    expect(res.destination).toHaveLength(0);
    expect(res.approximateNearby).toHaveLength(0);
    expect(res.imprecise.map((i) => i.id)).toEqual(["inc-dist-1", "inc-null-1"]);
  });
});
