import { describe, expect, it } from "vitest";
import { locationPrompt, matchedCravings, priceLabel, priceLevels, restaurantHref, searchCacheKey, searchPoint, textQuery } from "@/lib/places/query";

describe("restaurant search query", () => {
  it("turns matched cravings and diet filters into a Places text query", () => {
    expect(textQuery(["Biryani", "not-a-food"], ["veg", "halal"])).toBe("Biryani pure vegetarian halal restaurant");
    expect(textQuery([], [])).toBe("restaurants restaurant");
    expect(matchedCravings("Biryani and Coffee")).toEqual(["Biryani", "Coffee"]);
  });

  it("maps price and rounds the search point to about a kilometre", () => {
    expect(priceLevels(2)).toEqual(["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"]);
    expect(priceLevels(0)).toEqual([]);
    expect(priceLabel("PRICE_LEVEL_EXPENSIVE")).toBe("₹₹₹");
    expect(searchPoint(12.97159, 77.59456)).toEqual({ lat: 12.97, lng: 77.59 });
    expect(searchPoint(120, 10)).toBeNull();
  });

  it("keeps the same cache key for the same filters and a stable meetup link", () => {
    const input = { cravings: ["Sushi"], diets: ["jain"], maxPrice: 2, minRating: 4.5, openNow: true, lat: 12.97, lng: 77.59, area: "" };
    expect(locationPrompt({ ...input, area: "Indiranagar" })).toContain("in Indiranagar");
    expect(searchCacheKey(input)).toBe(searchCacheKey({ ...input }));
    expect(searchCacheKey({ ...input, openNow: false })).not.toBe(searchCacheKey(input));
    expect(restaurantHref({ withId: "abc", name: "Asha", food: "Biryani" })).toBe("/restaurants?with=abc&name=Asha&food=Biryani");
  });
});
