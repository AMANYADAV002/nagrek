import { NextResponse, type NextRequest } from "next/server";
import { officialSettings } from "@/lib/digilocker/mode";
import { revokeOfficialToken } from "@/lib/digilocker/official";
import { clearLockerCookies, readSessionCookie, SESSION_COOKIE } from "@/lib/digilocker/session";
import { sameOrigin } from "@/lib/security/kyc";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "DigiLocker could not be disconnected." }, { status: 403 });
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`dl-off:${member.userId}`, 10, 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const session = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session && session !== "expired" && session.mode === "official") {
    const settings = officialSettings();
    if (settings) await revokeOfficialToken(settings, session.accessToken);
  }
  const response = NextResponse.json({ ok: true });
  clearLockerCookies(response);
  return response;
}
