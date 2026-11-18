import { NextResponse, type NextRequest } from "next/server";
import { digilockerMode } from "@/lib/digilocker/mode";
import { readSessionCookie, SESSION_COOKIE } from "@/lib/digilocker/session";
import { getMember } from "@/lib/server/caller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  const mode = digilockerMode();
  const session = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session === "expired") {
    return NextResponse.json({ mode, connected: false, expired: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!session || session.mode !== mode) {
    return NextResponse.json({ mode, connected: false, expired: false }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    {
      mode,
      connected: true,
      expired: false,
      name: session.account.name,
      digilockerId: session.account.digilockerId,
      adult: session.account.adult,
      expiresAt: session.expiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
