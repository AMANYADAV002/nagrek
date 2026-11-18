import { NextResponse } from "next/server";
import { z } from "zod";
import { allowedMediaUrl, fallbackMedia, playableMediaUrl, type MediaHit, type MediaKind } from "@/lib/chat/media";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(40).optional(),
  kind: z.enum(["gif", "sticker"]).optional(),
});

const HINT = "Add GIPHY_API_KEY to .env.local for live GIFs and stickers. These reactions work right now.";

interface GiphyImage {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyGif {
  id: string;
  title?: string;
  images?: Record<string, GiphyImage | undefined>;
}

/** Rendition `.url` values only. The GIF object's own `url` is the giphy.com page, and `.webp` / `.mp4` do not decode in an img tag. */
function gifFile(image: GiphyImage | undefined) {
  const raw = image?.url ?? "";
  if (!raw || /\.mp4($|\?)/i.test(raw)) return null;
  const url = playableMediaUrl(raw);
  try {
    if (!allowedMediaUrl(url) || !new URL(url).pathname.toLowerCase().endsWith(".gif")) return null;
  } catch {
    return null;
  }
  return { url, width: Number(image?.width) || 0, height: Number(image?.height) || 0 };
}

function fromGiphy(gif: GiphyGif, kind: MediaKind): MediaHit | null {
  const full = gifFile(gif.images?.fixed_width) ?? gifFile(gif.images?.fixed_height);
  const preview = gifFile(gif.images?.fixed_width_small) ?? gifFile(gif.images?.fixed_height_small) ?? full;
  if (!full || !preview) return null;
  return {
    id: gif.id,
    kind,
    title: (gif.title || (kind === "sticker" ? "Sticker" : "GIF")).slice(0, 80),
    preview: preview.url,
    url: full.url,
    emoji: "",
    width: full.width,
    height: full.height,
  };
}

/** Trending and search for the chat picker. The Giphy key stays on the server. */
export async function GET(request: Request) {
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`media:${member.userId}`, 40, 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? undefined, kind: url.searchParams.get("kind") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "That search is too long." }, { status: 400 });
  const kind = parsed.data.kind ?? "gif";
  const q = parsed.data.q ?? "";
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { items: fallbackMedia(kind, q), source: "fallback", hint: HINT },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const endpoint = q
    ? `https://api.giphy.com/v1/${kind === "sticker" ? "stickers" : "gifs"}/search`
    : `https://api.giphy.com/v1/${kind === "sticker" ? "stickers" : "gifs"}/trending`;
  const params = new URLSearchParams({ api_key: key, limit: "24", rating: "pg", lang: "en", bundle: "messaging_non_clips" });
  if (q) params.set("q", q);

  try {
    const res = await fetch(`${endpoint}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.status === 401) {
      return NextResponse.json(
        { items: fallbackMedia(kind, q), source: "fallback", hint: "Giphy rejected the API key. Check GIPHY_API_KEY in .env.local." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!res.ok) throw new Error("giphy");
    const data = (await res.json()) as { data?: GiphyGif[] };
    const items = (data.data ?? []).map((gif) => fromGiphy(gif, kind)).filter((item): item is MediaHit => item !== null);
    return NextResponse.json(
      { items, source: "giphy", hint: items.length ? "" : "Nothing matched. Try Hungry, Pizza, or Cheers." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { items: fallbackMedia(kind, q), source: "fallback", hint: "Giphy is unavailable. Showing reactions instead." },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
