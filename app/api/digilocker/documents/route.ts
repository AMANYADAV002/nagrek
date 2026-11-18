import { NextResponse, type NextRequest } from "next/server";
import { mockDocuments } from "@/lib/digilocker/mock";
import { officialDocuments } from "@/lib/digilocker/official";
import { readSessionCookie, SESSION_COOKIE } from "@/lib/digilocker/session";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`dl-list:${member.userId}`, 30, 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const session = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session === "expired") return NextResponse.json({ error: "The DigiLocker session expired. Connect again." }, { status: 401 });
  if (!session) return NextResponse.json({ error: "Connect DigiLocker first." }, { status: 401 });

  const documents = session.mode === "mock" ? mockDocuments(session.accessToken) : await officialDocuments(session.accessToken);
  if (documents === "expired") return NextResponse.json({ error: "The DigiLocker session expired. Connect again." }, { status: 401 });
  if (documents === "unauthorized") return NextResponse.json({ error: "Connect DigiLocker first." }, { status: 401 });
  if (documents === "backend") return NextResponse.json({ error: "DigiLocker did not respond." }, { status: 502 });
  return NextResponse.json({ documents }, { headers: { "Cache-Control": "no-store" } });
}
