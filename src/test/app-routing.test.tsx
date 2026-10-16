import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { generaliseLocation, looksIdentifying, searchPlaces, distanceKm } from "@/lib/herway";

async function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />, { container: document.body });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App routing", () => {
  it("loads and renders the index route", async () => {
    await renderAt("/");
    await waitFor(() => expect(document.body.innerHTML).not.toBe(""));
  });

  it("renders the not-found route gracefully", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await renderAt("/this-route-does-not-exist");
    await waitFor(() => expect(document.body.innerHTML).toContain("Page not found"));
  });
});

describe("Privacy & Location rounding", () => {
  it("generalises coordinates so exact point is never exposed", () => {
    const lat = 23.8103;
    const lng = 90.4125;
    const rounded = generaliseLocation(lat, lng);

    expect(rounded.lat).toBeDefined();
    expect(rounded.lng).toBeDefined();
    // Distance should be within ~500m (grid + bounded jitter)
    const dist = distanceKm(lat, lng, rounded.lat, rounded.lng);
    expect(dist).toBeLessThan(1.0); // within 1km
    // Must not be identical to original exact coordinate
    expect(rounded.lat !== lat || rounded.lng !== lng).toBe(true);
  });

  it("detects identifying phone numbers, emails, and handles", () => {
    expect(looksIdentifying("Call me at 01712345678")).toBe(true);
    expect(looksIdentifying("Contact: +8801812345678")).toBe(true);
    expect(looksIdentifying("Email: test@example.com")).toBe(true);
    expect(looksIdentifying("Follow @user_handle on instagram")).toBe(true);
    expect(looksIdentifying("Walked past the bus stand near Farmgate.")).toBe(false);
  });
});

describe("Production Place Geocoder", () => {
  it("returns empty results for short queries", async () => {
    const res = await searchPlaces("a");
    expect(res).toEqual([]);
  });

  it("parses fallback autocomplete place results safely", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { coordinates: [90.368, 23.807] },
            properties: { name: "Mirpur 10", district: "Dhaka", state: "Dhaka Division" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fakeFetch);

    const results = await searchPlaces("Mirpur 10");
    expect(results.length).toBe(1);
    expect(results[0].label).toContain("Mirpur 10");
    expect(results[0].lat).toBe(23.807);
    expect(results[0].lng).toBe(90.368);
  });
});
