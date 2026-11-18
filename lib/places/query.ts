import { roundCoord } from "@/lib/validation/onboarding";

/** Cuisines the restaurant filter can send to Google Places. */
export const PLACE_CRAVINGS = [
  "Biryani",
  "Coffee",
  "Pizza",
  "Burger",
  "Sushi",
  "North Indian",
  "South Indian",
  "Desserts",
  "Cafes",
  "Dosa",
  "Momos",
  "Chinese",
  "Thai",
  "Italian",
  "Ramen",
  "Street food",
] as const;

export const DIET_FILTERS = [
  { id: "veg", label: "Pure Veg" },
  { id: "non-veg", label: "Non-Veg" },
  { id: "halal", label: "Halal" },
  { id: "jain", label: "Jain Food" },
  { id: "vegan", label: "Vegan" },
  { id: "eggless", label: "Eggless / Gluten-Free" },
] as const;

export type DietId = (typeof DIET_FILTERS)[number]["id"];

const DIET_WORDS: Record<DietId, string> = {
  veg: "pure vegetarian",
  "non-veg": "non vegetarian",
  halal: "halal",
  jain: "jain",
  vegan: "vegan",
  eggless: "eggless gluten-free",
};

const PRICE_LEVELS = [
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE",
] as const;

export interface PlaceSearchInput {
  cravings: string[];
  diets: string[];
  /** 0 means any price. 1–4 is the highest ₹ level to include. */
  maxPrice: number;
  /** 0, 4, or 4.5 */
  minRating: number;
  openNow: boolean;
  lat: number;
  lng: number;
  /** Neighborhood or city typed by the user. Empty when the search is only "near me". */
  area: string;
}

export function allowedCraving(value: string) {
  const hit = PLACE_CRAVINGS.find((item) => item.toLowerCase() === value.trim().toLowerCase());
  return hit ?? "";
}

export function allowedDiet(value: string): DietId | "" {
  const hit = DIET_FILTERS.find((item) => item.id === value);
  return hit?.id ?? "";
}

/** Craving and diet words composed into the Gemini prompt. */
export function textQuery(cravings: string[], diets: string[]) {
  const foods = cravings.map(allowedCraving).filter(Boolean);
  const dietWords = diets.map((diet) => (allowedDiet(diet) ? DIET_WORDS[allowedDiet(diet) as DietId] : "")).filter(Boolean);
  const core = [...foods, ...dietWords].join(" ");
  return `${core || "restaurants"} restaurant`.slice(0, 160);
}

/** The user location query sent as Gemini contents text. */
export function locationPrompt(input: Pick<PlaceSearchInput, "cravings" | "diets" | "maxPrice" | "minRating" | "openNow" | "area">) {
  const where = input.area.trim() ? `in ${input.area.trim()}` : "near the given coordinates";
  const extras = [
    input.maxPrice > 0 ? `price up to ${"₹".repeat(input.maxPrice)}` : "",
    input.minRating >= 4 ? `rated ${input.minRating}+` : "",
    input.openNow ? "open now" : "",
  ].filter(Boolean);
  const sentence = `Find real restaurants ${where} for ${textQuery(input.cravings, input.diets)}${extras.length ? `, ${extras.join(", ")}` : ""}.`;
  return sentence.slice(0, 500);
}

export function priceLevels(maxPrice: number) {
  if (maxPrice < 1 || maxPrice > 4) return [];
  return PRICE_LEVELS.slice(0, maxPrice);
}

export function priceLabel(level: string | undefined) {
  const index = PRICE_LEVELS.indexOf(level as (typeof PRICE_LEVELS)[number]);
  if (index < 0) return "";
  return "₹".repeat(index + 1);
}

/** ~1 km, same rounding the rest of the app uses before a coordinate leaves the device. */
export function searchPoint(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

export function searchCacheKey(input: PlaceSearchInput) {
  const point = searchPoint(input.lat, input.lng);
  return [
    point ? point.lat.toFixed(2) : "none",
    point ? point.lng.toFixed(2) : "none",
    (input.area ?? "").trim().toLowerCase(),
    textQuery(input.cravings, input.diets),
    priceLevels(input.maxPrice).join(","),
    input.minRating,
    input.openNow ? "open" : "any",
  ].join("|");
}

export function restaurantHref(input: { withId: string; name?: string; food?: string | null }) {
  const params = new URLSearchParams({ with: input.withId });
  if (input.name) params.set("name", input.name);
  if (input.food) params.set("food", input.food);
  return `/restaurants?${params.toString()}`;
}

export function matchedCravings(food: string | null | undefined) {
  if (!food) return [];
  const seen = new Set<string>();
  for (const part of food.split(/[,&+/]| and /i)) {
    const craving = allowedCraving(part);
    if (craving) seen.add(craving);
  }
  if (seen.size === 0) {
    const whole = allowedCraving(food);
    if (whole) seen.add(whole);
  }
  return [...seen];
}
