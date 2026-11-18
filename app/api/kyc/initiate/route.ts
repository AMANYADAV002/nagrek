import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, isAdultDob, readBody, sameOrigin } from "@/lib/security/kyc";
import { referenceHash } from "@/lib/security/vault-crypto";
import { kycEnforced, sandboxEnabled, setuConfigured } from "@/lib/kyc/mode";
import { startSetuDigilocker } from "@/lib/kyc/provider";
import { markKycPending } from "@/lib/kyc/record";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();

/**
 * Starts a zero-storage KYC check. Setu returns a redirect. Sandbox only records "pending".
 * This route never stores an identity number, a photo, or the posted date of birth.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Verification could not be started." }, { status: 403 });
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });

  const ip = clientIp(request) ?? "unknown";
  if (rateLimited(`kyc:${member.userId}`, 5, 60 * 60_000) || rateLimited(`kyc-ip:${ip}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  const raw = await readBody(request, 256);
  if (raw == null) return NextResponse.json({ error: "Verification could not be started." }, { status: 400 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Verification could not be started." }, { status: 400 });
  }
  const posted = bodySchema.safeParse(json);
  if (!posted.success || !isAdultDob(posted.data.dateOfBirth)) {
    return NextResponse.json({ error: "Nagrek is only for people 18 and over." }, { status: 403 });
  }

  const { data: auth } = await member.supabase.auth.getUser();
  if (!auth.user?.email_confirmed_at) return NextResponse.json({ error: "Confirm your email before verification." }, { status: 403 });

  const { data: prefs } = await member.admin.from("user_preferences").select("date_of_birth").eq("user_id", member.userId).maybeSingle();
  const dob = prefs?.date_of_birth;
  if (typeof dob !== "string" || dob.slice(0, 10) !== posted.data.dateOfBirth || !isAdultDob(dob.slice(0, 10))) {
    return NextResponse.json({ error: "Nagrek is only for people 18 and over." }, { status: 403 });
  }

  if (!kycEnforced()) return NextResponse.json({ error: "Identity verification is not configured." }, { status: 503 });

  if (setuConfigured()) {
    const salt = process.env.KYC_HASH_SALT;
    if (!salt) return NextResponse.json({ error: "Identity verification is not configured." }, { status: 503 });
    const redirectUrl = new URL("/verify-kyc", request.url).toString();
    const started = await startSetuDigilocker(redirectUrl);
    if (!started) return NextResponse.json({ error: "Identity verification is not configured." }, { status: 503 });
    const id = await markKycPending(member.admin, member.userId, "setu", ip, referenceHash(started.id, salt));
    if (!id) return NextResponse.json({ error: "Verification could not be started." }, { status: 503 });
    return NextResponse.json({ verificationId: id, mode: "setu", redirectUrl: started.url });
  }

  if (!sandboxEnabled()) return NextResponse.json({ error: "Identity verification is not configured." }, { status: 503 });
  const id = await markKycPending(member.admin, member.userId, "sandbox", ip);
  if (!id) return NextResponse.json({ error: "Verification could not be started." }, { status: 503 });
  return NextResponse.json({ verificationId: id, mode: "sandbox" });
}
