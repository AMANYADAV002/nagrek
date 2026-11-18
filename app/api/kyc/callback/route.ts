import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { clientIp, readBody, sameOrigin } from "@/lib/security/kyc";
import { referenceHash } from "@/lib/security/vault-crypto";
import { confirmSetuDigilocker } from "@/lib/kyc/provider";
import { sealKycResult } from "@/lib/kyc/record";
import { getMember } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ requestId: z.uuid() }).strict();

/** DigiLocker return. The browser sends only the request id. Age is checked on the server, then discarded. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Verification was rejected." }, { status: 403 });
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`kyc-cb:${member.userId}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  const salt = process.env.KYC_HASH_SALT;
  if (!salt) return NextResponse.json({ error: "Verification is unavailable." }, { status: 503 });

  const raw = await readBody(request, 256);
  if (raw == null) return NextResponse.json({ error: "Verification was rejected." }, { status: 400 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Verification was rejected." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Verification was rejected." }, { status: 400 });

  const { data: row } = await member.admin
    .from("kyc_verifications")
    .select("reference_hash, status")
    .eq("user_id", member.userId)
    .maybeSingle();
  const expected = typeof row?.reference_hash === "string" ? row.reference_hash : "";
  const actual = referenceHash(parsed.data.requestId, salt);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);
  if (expectedBuf.length === 0 || expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return NextResponse.json({ error: "Verification was rejected." }, { status: 403 });
  }
  if (row?.status === "verified") return NextResponse.json({ ok: true, status: "verified" });

  const age = await confirmSetuDigilocker(parsed.data.requestId);
  if (age === "unavailable") return NextResponse.json({ error: "Verification is still pending." }, { status: 409 });

  const status = age === "adult" ? "verified" : "rejected";
  const saved = await sealKycResult(member.admin, {
    userId: member.userId,
    status,
    provider: "setu",
    reference: parsed.data.requestId,
    ip: clientIp(request),
  });
  if (!saved) return NextResponse.json({ error: "Verification was rejected." }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
