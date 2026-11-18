import { NextResponse, type NextRequest } from "next/server";
import { mockDocument } from "@/lib/digilocker/mock";
import { isAadhaarDocument, officialFile, safeDocumentUri } from "@/lib/digilocker/official";
import { officialSettings } from "@/lib/digilocker/mode";
import { readSessionCookie, SESSION_COOKIE } from "@/lib/digilocker/session";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`dl-file:${member.userId}`, 30, 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const session = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session === "expired") return NextResponse.json({ error: "The DigiLocker session expired. Connect again." }, { status: 401 });
  if (!session) return NextResponse.json({ error: "Connect DigiLocker first." }, { status: 401 });

  const uri = request.nextUrl.searchParams.get("uri") ?? "";
  const format = request.nextUrl.searchParams.get("format") === "xml" ? "xml" : "pdf";
  if (!safeDocumentUri(uri)) return NextResponse.json({ error: "That document was not found." }, { status: 404 });
  if (isAadhaarDocument({ uri })) return NextResponse.json({ error: "Aadhaar files are not downloaded." }, { status: 403 });

  const file = session.mode === "mock"
    ? mockDocument(session.accessToken, uri, format)
    : await (async () => {
        const settings = officialSettings();
        if (!settings) return "backend" as const;
        return officialFile(settings, session.accessToken, uri, format);
      })();

  if (file === "expired") return NextResponse.json({ error: "The DigiLocker session expired. Connect again." }, { status: 401 });
  if (file === "unauthorized") return NextResponse.json({ error: "Connect DigiLocker first." }, { status: 401 });
  if (file === "not_found") return NextResponse.json({ error: "That document was not found." }, { status: 404 });
  if (file === "aadhaar_blocked") return NextResponse.json({ error: "Aadhaar files are not downloaded." }, { status: 403 });
  if (file === "backend") return NextResponse.json({ error: "DigiLocker did not respond." }, { status: 502 });

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
