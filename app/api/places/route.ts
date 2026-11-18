import { NextResponse } from "next/server";
import { z } from "zod";
import { resolvePlace, searchRestaurants, suggestPlaces } from "@/lib/places/google";
import { allowedCraving, allowedDiet, searchPoint } from "@/lib/places/query";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const suggestSchema = z.object({
  mode: z.literal("suggest"),
  q: z.string().trim().max(80),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

const searchSchema = z.object({
  mode: z.literal("search"),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  area: z.string().trim().max(80).optional(),
  placeId: z.string().trim().max(200).optional(),
  cravings: z.string().max(200).optional(),
  diets: z.string().max(80).optional(),
  maxPrice: z.coerce.number().int().min(0).max(4).optional(),
  minRating: z.coerce.number().optional(),
  open: z.enum(["0", "1"]).optional(),
});

function list(value: string | undefined, keep: (item: string) => string) {
  return [...new Set((value ?? "").split(",").map(keep).filter(Boolean))];
}

/** Restaurant search and location suggestions. The API key stays on the server. */
export async function GET(request: Request) {
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`places:${member.userId}`, 60, 60_000)) return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429 });

  const raw = Object.fromEntries(new URL(request.url).searchParams);
  if (raw.mode === "suggest") {
    const parsed = suggestSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ suggestions: [], error: "Type a neighborhood or city." }, { status: 400 });
    const bias = parsed.data.lat !== undefined && parsed.data.lng !== undefined ? searchPoint(parsed.data.lat, parsed.data.lng) : null;
    return NextResponse.json(await suggestPlaces(parsed.data.q, bias ?? undefined));
  }

  const parsed = searchSchema.safeParse({ ...raw, mode: "search" });
  if (!parsed.success) return NextResponse.json({ restaurants: [], error: "Those filters are not valid." }, { status: 400 });

  const resolved = parsed.data.placeId ? await resolvePlace(parsed.data.placeId) : null;
  if (resolved && "error" in resolved) return NextResponse.json({ restaurants: [], error: resolved.error }, { status: 400 });
  const point = resolved
    ? { lat: resolved.lat, lng: resolved.lng }
    : parsed.data.lat !== undefined && parsed.data.lng !== undefined
      ? searchPoint(parsed.data.lat, parsed.data.lng)
      : null;
  const area = parsed.data.area || (resolved && !("error" in resolved) ? resolved.label : "") || "";
  if (!point && area.length < 2) return NextResponse.json({ restaurants: [], error: "Choose a location first." }, { status: 400 });

  const min = parsed.data.minRating === 4 || parsed.data.minRating === 4.5 ? parsed.data.minRating : 0;
  const result = await searchRestaurants({
    lat: point?.lat ?? Number.NaN,
    lng: point?.lng ?? Number.NaN,
    area,
    cravings: list(parsed.data.cravings, allowedCraving),
    diets: list(parsed.data.diets, allowedDiet),
    maxPrice: parsed.data.maxPrice ?? 0,
    minRating: min,
    openNow: parsed.data.open === "1",
  });
  return NextResponse.json(result);
}
