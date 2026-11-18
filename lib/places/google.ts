import type { Restaurant } from "@/lib/places/grounding";
import { priceLevels, searchCacheKey, searchPoint, textQuery, type PlaceSearchInput } from "@/lib/places/query";

const PLACES = "https://places.googleapis.com/v1/places:searchText";
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; restaurants: Restaurant[]; summary: string }>();

export type { Restaurant };

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
  servesVegetarianFood?: boolean;
  currentOpeningHours?: { openNow?: boolean };
  photos?: { name?: string }[];
  types?: string[];
}

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
  "places.servesVegetarianFood",
  "places.currentOpeningHours.openNow",
  "places.photos.name",
  "places.types",
].join(",");

const PRICE = ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];

function placesKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
}

export function placesConfigured() {
  return placesKey().length > 10;
}

function remember(cacheKey: string, restaurants: Restaurant[]) {
  cache.set(cacheKey, { at: Date.now(), restaurants, summary: "" });
  if (cache.size > 80) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

function badges(place: GooglePlace, diets: string[]) {
  const blob = `${place.displayName?.text ?? ""} ${(place.types ?? []).join(" ")}`.toLowerCase();
  const out: string[] = [];
  if (place.servesVegetarianFood || diets.includes("veg") || /\bveg\b|vegetarian/.test(blob)) out.push("Pure Veg");
  if (diets.includes("non-veg")) out.push("Non-Veg");
  if (diets.includes("halal") || blob.includes("halal")) out.push("Halal");
  if (diets.includes("jain") || blob.includes("jain")) out.push("Jain Friendly");
  if (diets.includes("vegan") || blob.includes("vegan")) out.push("Vegan");
  if (diets.includes("eggless") || blob.includes("eggless") || blob.includes("gluten")) out.push("Eggless / Gluten-Free");
  return [...new Set(out)];
}

function toRestaurant(place: GooglePlace, diets: string[]): Restaurant | null {
  const id = place.id?.replace(/^places\//, "") ?? "";
  const name = place.displayName?.text?.trim() ?? "";
  const mapsUrl = place.googleMapsUri ?? "";
  if (!id || !name || !mapsUrl.startsWith("https://")) return null;
  const photo = place.photos?.[0]?.name ?? "";
  const level = PRICE.indexOf(place.priceLevel ?? "");
  return {
    id,
    name,
    address: place.shortFormattedAddress || place.formattedAddress || "",
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    priceLabel: level >= 0 ? "₹".repeat(level + 1) : "",
    openNow: typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : null,
    mapsUrl,
    website: place.websiteUri?.startsWith("https://") ? place.websiteUri : null,
    photoName: /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo) ? photo : null,
    badges: badges(place, diets),
    cuisine: place.primaryTypeDisplayName?.text ?? null,
  };
}

/** Places Text Search. The key stays on the server. */
export async function searchRestaurants(input: PlaceSearchInput): Promise<{ restaurants: Restaurant[]; summary: string; error: string }> {
  const point = searchPoint(input.lat, input.lng);
  const area = input.area.trim().slice(0, 80);
  if (!point && area.length < 2) return { restaurants: [], summary: "", error: "Choose a location first." };
  const normalized: PlaceSearchInput = { ...input, lat: point?.lat ?? input.lat, lng: point?.lng ?? input.lng, area };
  const cacheKey = searchCacheKey(normalized);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return { restaurants: hit.restaurants, summary: "", error: "" };
  if (!placesConfigured()) return { restaurants: [], summary: "", error: "Add GOOGLE_PLACES_API_KEY to .env.local to load restaurants." };

  const levels = priceLevels(normalized.maxPrice);
  const text = [textQuery(normalized.cravings, normalized.diets), area].filter(Boolean).join(" ").slice(0, 160);
  try {
    const res = await fetch(PLACES, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": placesKey(), "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({
        textQuery: text,
        includedType: normalized.cravings.includes("Cafes") ? undefined : "restaurant",
        strictTypeFiltering: normalized.cravings.includes("Cafes") ? undefined : true,
        pageSize: 12,
        openNow: normalized.openNow || undefined,
        minRating: normalized.minRating >= 4 ? normalized.minRating : undefined,
        priceLevels: levels.length ? levels : undefined,
        locationBias: point ? { circle: { center: { latitude: point.lat, longitude: point.lng }, radius: 2500 } } : undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("places request failed", res.status);
      return { restaurants: [], summary: "", error: "Restaurant search is unavailable right now." };
    }
    const body = (await res.json()) as { places?: GooglePlace[] };
    const restaurants = (body.places ?? []).map((place) => toRestaurant(place, normalized.diets)).filter((place): place is Restaurant => !!place);
    remember(cacheKey, restaurants);
    return { restaurants, summary: "", error: "" };
  } catch (err) {
    console.error("places request failed", err instanceof Error ? err.name : "error");
    return { restaurants: [], summary: "", error: "Restaurant search is unavailable right now." };
  }
}

export interface PlaceSuggestion {
  placeId: string;
  label: string;
}

/** Neighborhood and city suggestions. The key stays on the server. */
export async function suggestPlaces(query: string, bias?: { lat: number; lng: number }): Promise<{ suggestions: PlaceSuggestion[]; error: string }> {
  const input = query.trim().slice(0, 80);
  if (input.length < 2) return { suggestions: [], error: "" };
  if (!placesConfigured()) return { suggestions: [], error: "Add GOOGLE_PLACES_API_KEY to .env.local to load restaurants." };
  const point = bias ? searchPoint(bias.lat, bias.lng) : null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": placesKey(),
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ["locality", "sublocality", "neighborhood"],
        locationBias: point ? { circle: { center: { latitude: point.lat, longitude: point.lng }, radius: 50000 } } : undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("places autocomplete failed", res.status);
      return { suggestions: [], error: "Location search is unavailable right now." };
    }
    const body = (await res.json()) as { suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[] };
    const suggestions = (body.suggestions ?? [])
      .map((item) => ({ placeId: item.placePrediction?.placeId ?? "", label: item.placePrediction?.text?.text ?? "" }))
      .filter((item) => item.placeId.length > 0 && item.label.length > 0)
      .slice(0, 6);
    return { suggestions, error: "" };
  } catch (err) {
    console.error("places autocomplete failed", err instanceof Error ? err.name : "error");
    return { suggestions: [], error: "Location search is unavailable right now." };
  }
}

/** Turns a chosen suggestion into a map point for the restaurant search. */
export async function resolvePlace(placeId: string): Promise<{ lat: number; lng: number; label: string } | { error: string }> {
  const id = placeId.replace(/^places\//, "");
  if (!/^[A-Za-z0-9_-]{8,}$/.test(id)) return { error: "Pick a location from the suggestions." };
  if (!placesConfigured()) return { error: "Add GOOGLE_PLACES_API_KEY to .env.local to load restaurants." };
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
      headers: { "X-Goog-Api-Key": placesKey(), "X-Goog-FieldMask": "location,displayName" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("places details failed", res.status);
      return { error: "That location could not be opened." };
    }
    const body = (await res.json()) as { location?: { latitude?: number; longitude?: number }; displayName?: { text?: string } };
    const point = searchPoint(body.location?.latitude ?? Number.NaN, body.location?.longitude ?? Number.NaN);
    if (!point) return { error: "That location has no map point." };
    return { ...point, label: body.displayName?.text ?? "That area" };
  } catch (err) {
    console.error("places details failed", err instanceof Error ? err.name : "error");
    return { error: "That location could not be opened." };
  }
}

export function clearPlaceCache() {
  cache.clear();
}
