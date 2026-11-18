import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/digilocker/official";
import { digilockerMode, officialSettings } from "@/lib/digilocker/mode";
import { createPkce, createState } from "@/lib/digilocker/pkce";
import { writeStateCookie } from "@/lib/digilocker/session";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`dl-connect:${member.userId}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  const mode = digilockerMode();
  if (mode === "off") return NextResponse.json({ error: "DigiLocker is not enabled." }, { status: 503 });
  const settings = officialSettings();
  if (mode === "official" && !settings) return NextResponse.json({ error: "DigiLocker credentials are not configured." }, { status: 503 });

  const state = createState();
  const { verifier, challenge } = createPkce();
  const target = mode === "mock"
    ? new URL(`/digilocker/mock-consent?state=${state}`, request.url)
    : authorizeUrl(settings!, state, challenge);
  const response = NextResponse.redirect(target);
  const saved = writeStateCookie(response, { state, verifier, exp: Date.now() + 10 * 60_000 });
  if (!saved) return NextResponse.json({ error: "DigiLocker is not enabled." }, { status: 503 });
  return response;
}
