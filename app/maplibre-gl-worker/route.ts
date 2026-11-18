import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

/** Same-origin MapLibre worker. The bundler cannot place the package worker next to its chunk. */
export async function GET() {
  try {
    const file = path.join(process.cwd(), "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Map worker is unavailable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
