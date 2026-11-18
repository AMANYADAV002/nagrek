import { NextResponse } from "next/server";
import { clientIp, parseKycEvent, readBody } from "@/lib/security/kyc";
import { webhookAuthentic } from "@/lib/security/vault-crypto";
import { adultFromDigilocker, stripDateFields } from "@/lib/kyc/age";
import { sealKycResult } from "@/lib/kyc/record";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Provider callback. The signature is HMAC-SHA256 of `timestamp.body`. Identity fields are discarded. */
export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();
  const secret = process.env.KYC_WEBHOOK_SECRET;
  if (!admin || !secret || !process.env.KYC_HASH_SALT) return NextResponse.json({ error: "Verification is unavailable." }, { status: 503 });

  const body = await readBody(request, 8_192);
  if (body == null) return NextResponse.json({ error: "Verification was rejected." }, { status: 400 });

  const timestamp = request.headers.get("x-kyc-timestamp") ?? "";
  const signature = request.headers.get("x-kyc-signature") ?? "";
  if (!webhookAuthentic(secret, timestamp, body, signature)) return NextResponse.json({ error: "Verification was rejected." }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Verification was rejected." }, { status: 400 });
  }

  const age = adultFromDigilocker(json);
  if (age === false) return NextResponse.json({ error: "Verification was rejected." }, { status: 403 });
  const stripped = stripDateFields(json);
  const eventInput = age === true && stripped && typeof stripped === "object" && !Array.isArray(stripped)
    ? { ...stripped, age_verified: true }
    : stripped;
  const event = parseKycEvent(eventInput);
  if (!event) return NextResponse.json({ error: "Verification was rejected." }, { status: 400 });

  const saved = await sealKycResult(admin, {
    userId: event.user_id,
    status: event.status,
    provider: event.provider,
    reference: event.reference,
    ip: clientIp(request),
  });
  if (!saved) return NextResponse.json({ error: "Verification was rejected." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
