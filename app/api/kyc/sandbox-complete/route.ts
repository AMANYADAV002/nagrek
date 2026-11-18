import { NextResponse } from "next/server";
import { clientIp, isAdultDob, sameOrigin } from "@/lib/security/kyc";
import { sandboxRouteAllowed } from "@/lib/kyc/mode";
import { sealKycResult } from "@/lib/kyc/record";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local simulator for the webhook, encryption, and email path. Disabled in production. */
export async function POST(request: Request) {
  if (!sandboxRouteAllowed()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Verification was rejected." }, { status: 403 });
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`kyc-sim:${member.userId}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  const { data: prefs } = await member.admin.from("user_preferences").select("date_of_birth").eq("user_id", member.userId).maybeSingle();
  const dob = prefs?.date_of_birth;
  if (typeof dob !== "string" || !isAdultDob(dob.slice(0, 10))) {
    return NextResponse.json({ error: "Nagrek is only for people 18 and over." }, { status: 403 });
  }

  const saved = await sealKycResult(member.admin, {
    userId: member.userId,
    status: "verified",
    provider: "sandbox",
    reference: `sandbox-${crypto.randomUUID()}`,
    ip: clientIp(request),
  });
  if (!saved) return NextResponse.json({ error: "Verification was rejected." }, { status: 500 });
  return NextResponse.json({ ok: true, status: "verified" });
}
