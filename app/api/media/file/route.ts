import { NextResponse } from "next/server";
import { allowedMediaUrl, playableMediaUrl } from "@/lib/chat/media";
import { getCaller } from "@/lib/server/caller";
import { rateLimited } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8_000_000;

function gifBytes(bytes: Uint8Array) {
  if (bytes.byteLength < 6 || bytes.byteLength > MAX_BYTES) return false;
  const magic = String.fromCharCode(...bytes.subarray(0, 6));
  return magic === "GIF87a" || magic === "GIF89a";
}

/** Streams one allowed GIF through this origin so the chat tile can load it. */
export async function GET(request: Request) {
  const caller = await getCaller();
  if (!caller) return new NextResponse(null, { status: 401 });
  if (rateLimited(`media-file:${caller.userId}`, 180, 60_000)) return new NextResponse(null, { status: 429 });

  const raw = new URL(request.url).searchParams.get("src") ?? "";
  const target = playableMediaUrl(raw);
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!allowedMediaUrl(target) || !parsed.pathname.toLowerCase().endsWith(".gif")) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    let upstream = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location") ?? "";
      if (!allowedMediaUrl(location)) return new NextResponse(null, { status: 502 });
      upstream = await fetch(location, { redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store" });
    }
    if (!upstream.ok) return new NextResponse(null, { status: 502 });
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (!gifBytes(bytes)) return new NextResponse(null, { status: 502 });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
