export interface Restaurant {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLabel: string;
  openNow: boolean | null;
  mapsUrl: string;
  website: string | null;
  photoName: string | null;
  badges: string[];
  cuisine: string | null;
}

export interface MapsChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeId?: string;
    text?: string;
  };
}

function badges(text: string, diets: string[]) {
  const blob = text.toLowerCase();
  const out: string[] = [];
  if (diets.includes("veg") || /\bveg\b|vegetarian/.test(blob)) out.push("Pure Veg");
  if (diets.includes("non-veg")) out.push("Non-Veg");
  if (diets.includes("halal") || blob.includes("halal")) out.push("Halal");
  if (diets.includes("jain") || blob.includes("jain")) out.push("Jain Friendly");
  if (diets.includes("vegan") || blob.includes("vegan")) out.push("Vegan");
  if (diets.includes("eggless") || blob.includes("eggless") || blob.includes("gluten")) out.push("Eggless / Gluten-Free");
  return [...new Set(out)];
}

function ratingFrom(text: string) {
  const match = text.match(/\b([1-5](?:\.\d)?)\s*(?:\/\s*5|stars?)/i);
  if (!match) return null;
  const rating = Number(match[1]);
  return rating >= 1 && rating <= 5 ? rating : null;
}

function openFrom(text: string) {
  if (/\bopen now\b/i.test(text)) return true;
  if (/\bclosed\b/i.test(text)) return false;
  return null;
}

/** Place names and Maps links from Gemini grounding chunks. */
export function restaurantsFromChunks(chunks: MapsChunk[] | undefined, diets: string[]) {
  const seen = new Set<string>();
  const restaurants: Restaurant[] = [];
  for (const chunk of chunks ?? []) {
    const maps = chunk.maps;
    const name = maps?.title?.trim() ?? "";
    const mapsUrl = maps?.uri?.trim() ?? "";
    if (!name || !mapsUrl.startsWith("https://")) continue;
    const id = (maps?.placeId || mapsUrl).replace(/^places\//, "");
    if (seen.has(id)) continue;
    seen.add(id);
    const detail = (maps?.text ?? "").replace(/\s+/g, " ").trim();
    restaurants.push({
      id,
      name,
      address: detail.slice(0, 180),
      rating: ratingFrom(detail),
      reviewCount: null,
      priceLabel: "",
      openNow: openFrom(detail),
      mapsUrl,
      website: null,
      photoName: null,
      badges: badges(`${name} ${detail}`, diets),
      cuisine: null,
    });
  }
  return restaurants.slice(0, 12);
}
