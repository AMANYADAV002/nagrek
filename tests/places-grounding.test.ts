import { describe, expect, it } from "vitest";
import { restaurantsFromChunks } from "@/lib/places/grounding";

describe("Gemini Maps grounding chunks", () => {
  it("keeps place names and Maps links and drops chunks without a Maps url", () => {
    const restaurants = restaurantsFromChunks(
      [
        { maps: { title: "Meghana Foods", uri: "https://maps.google.com/?cid=1", placeId: "places/ChIJabc", text: "4.5 stars. Open now. Indiranagar" } },
        { maps: { title: "No link" } },
        { maps: { title: "Meghana Foods", uri: "https://maps.google.com/?cid=1", placeId: "places/ChIJabc" } },
      ],
      ["veg"],
    );
    expect(restaurants).toHaveLength(1);
    expect(restaurants[0]).toMatchObject({
      id: "ChIJabc",
      name: "Meghana Foods",
      mapsUrl: "https://maps.google.com/?cid=1",
      rating: 4.5,
      openNow: true,
    });
    expect(restaurants[0]?.badges).toContain("Pure Veg");
  });
});
