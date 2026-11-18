import { NextResponse } from "next/server";
import { placesConfigured } from "@/lib/places/google";
import { getMember } from "@/lib/server/caller";
import { rateLimited } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const NAME = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/** Serves a Places photo without putting the API key in the browser. */
export async function GET(request: Request) {
  const member = await getMember();
  if ("error" in member) return new NextResponse(null, { status: 401 });
  if (rateLimited(`place-photo:${member.userId}`, 120, 60_000)) return new NextResponse(null, { status: 429 });
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!NAME.test(name) || !placesConfigured()) return new NextResponse(null, { status: 400 });

  const key = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set("maxWidthPx", "800");
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!res.ok || !res.body) return new NextResponse(null, { status: 502 });
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return new NextResponse(null, { status: 502 });
    return new NextResponse(res.body, {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
