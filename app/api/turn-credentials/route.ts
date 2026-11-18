import { NextResponse } from "next/server";
import { z } from "zod";
import { readBody, sameOrigin } from "@/lib/security/kyc";
import { callMayRelay } from "@/lib/security/turn-access";
import { getMember, type Caller } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { iceConfigFor } from "@/lib/webrtc/turn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ callId: z.uuid().optional(), matchId: z.uuid().optional() })
  .strict()
  .refine((body) => Number(Boolean(body.callId)) + Number(Boolean(body.matchId)) === 1);

/**
 * Short-lived TURN credentials for one open call.
 * Both people must already have a verified KYC row. The shared TURN secret is not returned.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Call relay is unavailable." }, { status: 403 });
  const member = await getMember();
  if ("error" in member) return NextResponse.json({ error: member.error }, { status: 401 });
  if (rateLimited(`turn:${member.userId}`, 20, 60_000)) {
    return NextResponse.json({ error: SLOW_DOWN.error }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const raw = await readBody(request, 1_024);
  if (raw == null) return NextResponse.json({ error: "Call relay is unavailable." }, { status: 400 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Call relay is unavailable." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Call relay is unavailable." }, { status: 400 });

  const relayUsers = await relayPair(member.admin, member.userId, parsed.data);
  if (!relayUsers) return NextResponse.json({ error: "Call relay is unavailable." }, { status: 403 });

  const ice = iceConfigFor(member.userId, Date.now(), 10 * 60);
  const hasTurn = ice.iceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => url.startsWith("turn:") || url.startsWith("turns:"));
  });
  if (!hasTurn) return NextResponse.json({ error: "Call relay is unavailable." }, { status: 503 });
  return NextResponse.json({ ...ice, relayOnly: true }, { headers: { "Cache-Control": "no-store" } });
}

async function bothVerified(admin: Caller["admin"], first: string, second: string): Promise<boolean> {
  const { data: checks } = await admin.from("kyc_verifications").select("user_id, status").in("user_id", [first, second]);
  const verified = new Set((checks ?? []).filter((row) => row.status === "verified").map((row) => row.user_id));
  return verified.has(first) && verified.has(second);
}

async function relayPair(
  admin: Caller["admin"],
  userId: string,
  body: { callId?: string; matchId?: string },
): Promise<boolean> {
  if (body.matchId) {
    const { data: match } = await admin.from("matches").select("user_a, user_b, status").eq("id", body.matchId).maybeSingle();
    const row = z.object({ user_a: z.uuid(), user_b: z.uuid(), status: z.literal("live") }).safeParse(match);
    if (!row.success) return false;
    if (userId !== row.data.user_a && userId !== row.data.user_b) return false;
    return bothVerified(admin, row.data.user_a, row.data.user_b);
  }

  const { data: call } = await admin.from("calls").select("caller_id, callee_id, status").eq("id", body.callId ?? "").maybeSingle();
  const ids = z.object({ caller_id: z.uuid(), callee_id: z.uuid(), status: z.string() }).safeParse(call);
  if (!ids.success) return false;
  const pair = `and(user_a.eq.${ids.data.caller_id},user_b.eq.${ids.data.callee_id}),and(user_a.eq.${ids.data.callee_id},user_b.eq.${ids.data.caller_id})`;
  const link = `and(requester_id.eq.${ids.data.caller_id},addressee_id.eq.${ids.data.callee_id}),and(requester_id.eq.${ids.data.callee_id},addressee_id.eq.${ids.data.caller_id})`;
  const [{ data: match }, { data: connection }, verified] = await Promise.all([
    admin.from("matches").select("id").eq("status", "live").or(pair).limit(1).maybeSingle(),
    admin.from("connections").select("id").eq("status", "accepted").or(link).limit(1).maybeSingle(),
    bothVerified(admin, ids.data.caller_id, ids.data.callee_id),
  ]);
  return callMayRelay({
    userId,
    callerId: ids.data.caller_id,
    calleeId: ids.data.callee_id,
    status: ids.data.status,
    matchLive: Boolean(match),
    connectionAccepted: Boolean(connection),
    callerVerified: verified,
    calleeVerified: verified,
  });
}
