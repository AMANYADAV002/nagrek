"use server";

import { z } from "zod";
import { loadPerson } from "@/lib/people";
import { getCaller, getMember, startOfIndianDay, type Caller, type Fail } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { blockedEitherWay } from "@/lib/people";
import { unreachableReason } from "@/lib/server/relationship";
import { callAvailability, RING_MS, type OpenCall } from "@/lib/calls/availability";
import type { MockUser } from "@/lib/types";

/** Unanswered calls stop ringing after this long and count as missed. */
const RING_SECONDS = RING_MS / 1000;
const MAX_CALLS_PER_DAY = 100;
const idSchema = z.uuid();

export type CallKind = "voice" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "missed" | "cancelled" | "ended";

interface CallRow {
  id: string;
  caller_id: string;
  callee_id: string;
  kind: CallKind;
  status: CallStatus;
  created_at: string;
}

const CALL_COLUMNS = "id, caller_id, callee_id, kind, status, created_at";

async function notify(admin: Caller["admin"], userId: string, kind: string, payload: Record<string, string>) {
  await admin.from("notifications").insert({ user_id: userId, kind, payload });
}

async function nameOf(admin: Caller["admin"], userId: string) {
  const { data } = await admin.from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name ?? "Someone";
}

/** Marks ringing calls older than RING_SECONDS as missed and tells the callee. */
async function expireRinging(admin: Caller["admin"], call: CallRow): Promise<CallRow> {
  if (call.status !== "ringing" || Date.now() - new Date(call.created_at).getTime() < RING_SECONDS * 1000) return call;
  const { data } = await admin
    .from("calls")
    .update({ status: "missed", ended_at: new Date().toISOString() })
    .eq("id", call.id)
    .eq("status", "ringing")
    .select(CALL_COLUMNS)
    .maybeSingle();
  if (data) await notify(admin, call.callee_id, "call_missed", { callId: call.id, from: call.caller_id, name: await nameOf(admin, call.caller_id), kind: call.kind });
  return (data as CallRow | null) ?? { ...call, status: "missed" };
}

async function participantCall(callId: string) {
  if (!idSchema.safeParse(callId).success) return null;
  const caller = await getCaller();
  if (!caller) return null;
  const { data } = await caller.admin.from("calls").select(CALL_COLUMNS).eq("id", callId).maybeSingle();
  const call = data as CallRow | null;
  if (!call || (call.caller_id !== caller.userId && call.callee_id !== caller.userId)) return null;
  return { ...caller, call: await expireRinging(caller.admin, call) };
}

/** Rings someone by their app user id. No phone numbers are involved anywhere. A live match may call without a prior connection. */
export async function startCall(calleeId: string, kind: CallKind, fromMatchId?: string): Promise<{ ok: true; callId: string } | Fail> {
  if (!idSchema.safeParse(calleeId).success || !["voice", "video"].includes(kind)) return { ok: false, error: "Invalid call" };
  const m = await getMember();
  if ("error" in m) return m;
  const { admin, userId } = m;
  if (rateLimited(`call:${userId}`, 5, 60_000)) return SLOW_DOWN;

  if (fromMatchId) {
    if (!idSchema.safeParse(fromMatchId).success) return { ok: false, error: "Invalid call" };
    const { data: match } = await admin.from("matches").select("user_a, user_b, status").eq("id", fromMatchId).maybeSingle();
    const pair = match && match.status === "live" && ((match.user_a === userId && match.user_b === calleeId) || (match.user_b === userId && match.user_a === calleeId));
    if (!pair) return { ok: false, error: "This match is no longer live." };
    const blocked = await blockedEitherWay(userId);
    const { data: other } = await admin.from("profiles").select("suspended, onboarded_at").eq("id", calleeId).maybeSingle();
    if (!other || other.suspended || !other.onboarded_at || blocked.has(calleeId)) return { ok: false, error: "This person isn't available." };
  } else {
    const reason = await unreachableReason(admin, userId, calleeId);
    if (reason) return { ok: false, error: reason };
  }

  const { count } = await admin
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("caller_id", userId)
    .gte("created_at", startOfIndianDay());
  if ((count ?? 0) >= MAX_CALLS_PER_DAY) return { ok: false, error: "You've reached today's call limit." };

  const now = new Date().toISOString();
  const ringCutoff = new Date(Date.now() - RING_MS).toISOString();
  const abandonedCutoff = new Date(Date.now() - 90_000).toISOString();
  // A timed-out ring or a call that never connected is not a live call.
  await Promise.all([
    admin.from("calls").update({ status: "missed", ended_at: now }).eq("caller_id", calleeId).eq("status", "ringing").lt("created_at", ringCutoff),
    admin.from("calls").update({ status: "missed", ended_at: now }).eq("callee_id", calleeId).eq("status", "ringing").lt("created_at", ringCutoff),
    admin.from("calls").update({ status: "ended", ended_at: now }).eq("caller_id", calleeId).eq("status", "accepted").is("connected_at", null).lt("created_at", abandonedCutoff),
    admin.from("calls").update({ status: "ended", ended_at: now }).eq("callee_id", calleeId).eq("status", "accepted").is("connected_at", null).lt("created_at", abandonedCutoff),
  ]);

  const since = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  const columns = "id, caller_id, callee_id, status, created_at, connected_at";
  const [themCaller, themCallee] = await Promise.all([
    admin.from("calls").select(columns).eq("caller_id", calleeId).in("status", ["ringing", "accepted"]).gte("created_at", since),
    admin.from("calls").select(columns).eq("callee_id", calleeId).in("status", ["ringing", "accepted"]).gte("created_at", since),
  ]);
  const open = new Map<string, OpenCall>();
  for (const row of [...(themCaller.data ?? []), ...(themCallee.data ?? [])]) open.set(row.id, row as OpenCall);
  const choice = callAvailability(userId, calleeId, [...open.values()]);
  if (choice.action === "reuse") {
    await Promise.all([
      admin.from("calls").update({ status: "ended", ended_at: now }).eq("caller_id", userId).eq("status", "accepted").neq("id", choice.callId),
      admin.from("calls").update({ status: "ended", ended_at: now }).eq("callee_id", userId).eq("status", "accepted").neq("id", choice.callId),
    ]);
    return { ok: true, callId: choice.callId };
  }
  if (choice.action === "busy") return { ok: false, error: "They're on another call. Try again in a minute." };

  // This person's previous open call is over (refresh, closed tab, lost network).
  await Promise.all([
    admin.from("calls").update({ status: "ended", ended_at: now }).eq("caller_id", userId).eq("status", "accepted"),
    admin.from("calls").update({ status: "ended", ended_at: now }).eq("callee_id", userId).eq("status", "accepted"),
    admin.from("calls").update({ status: "cancelled", ended_at: now }).eq("caller_id", userId).eq("status", "ringing"),
  ]);

  const { data, error } = await admin.from("calls").insert({ caller_id: userId, callee_id: calleeId, kind }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start the call" };
  return { ok: true, callId: data.id };
}

/** Starts a call with the other person on a live match. No phone number and no prior connection required. */
export async function startMatchCall(matchId: string, kind: CallKind): Promise<{ ok: true; callId: string } | Fail> {
  if (!idSchema.safeParse(matchId).success) return { ok: false, error: "Invalid call" };
  const m = await getMember();
  if ("error" in m) return m;
  const { data: match } = await m.admin.from("matches").select("user_a, user_b").eq("id", matchId).maybeSingle();
  if (!match) return { ok: false, error: "Match not found" };
  const calleeId = match.user_a === m.userId ? match.user_b : match.user_a;
  return startCall(calleeId, kind, matchId);
}

/** The callee picks up or declines. Fails if the call stopped ringing in the meantime. */
export async function answerCall(callId: string, accept: boolean): Promise<{ ok: true } | Fail> {
  const p = await participantCall(callId);
  if (!p || p.call.callee_id !== p.userId) return { ok: false, error: "Call not found" };
  if (p.call.status !== "ringing") return { ok: false, error: "This call has ended." };
  const now = new Date().toISOString();
  const { data } = await p.admin
    .from("calls")
    .update(accept ? { status: "accepted", answered_at: now } : { status: "declined", ended_at: now })
    .eq("id", callId)
    .eq("status", "ringing")
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, error: "This call has ended." };
  return { ok: true };
}

/** Hang up. Before it is answered this cancels (caller, shows as missed) or declines (callee). */
export async function endCall(callId: string): Promise<{ ok: true } | Fail> {
  const p = await participantCall(callId);
  if (!p) return { ok: false, error: "Call not found" };
  const { admin, call, userId } = p;
  const now = new Date().toISOString();
  if (call.status === "ringing") {
    const isCaller = call.caller_id === userId;
    const { data } = await admin
      .from("calls")
      .update({ status: isCaller ? "cancelled" : "declined", ended_at: now })
      .eq("id", callId)
      .eq("status", "ringing")
      .select("id")
      .maybeSingle();
    if (data && isCaller) await notify(admin, call.callee_id, "call_missed", { callId, from: userId, name: await nameOf(admin, userId), kind: call.kind });
  } else if (call.status === "accepted") {
    await admin.from("calls").update({ status: "ended", ended_at: now }).eq("id", callId).eq("status", "accepted");
  }
  return { ok: true };
}

/** First time media connects. */
export async function markCallConnected(callId: string): Promise<void> {
  const p = await participantCall(callId);
  if (!p || p.call.status !== "accepted") return;
  await p.admin.from("calls").update({ connected_at: new Date().toISOString() }).eq("id", callId).is("connected_at", null);
}

export interface CallView {
  id: string;
  kind: CallKind;
  status: CallStatus;
  me: string;
  /** "a" (caller) makes the WebRTC offer. */
  role: "a" | "b";
  partner: MockUser;
}

export async function getCall(callId: string): Promise<CallView | null> {
  const p = await participantCall(callId);
  if (!p) return null;
  const { call, userId } = p;
  const partnerId = call.caller_id === userId ? call.callee_id : call.caller_id;
  const partner = await loadPerson(partnerId);
  if (!partner) return null;
  return { id: call.id, kind: call.kind, status: call.status, me: userId, role: call.caller_id === userId ? "a" : "b", partner };
}

export interface IncomingCall {
  id: string;
  kind: CallKind;
  from: { id: string; name: string; avatar: MockUser["avatar"] };
}

/** Calls ringing for the signed-in person right now (used when the app opens mid-ring). */
export async function loadIncomingCall(callId?: string): Promise<IncomingCall | null> {
  const caller = await getCaller();
  if (!caller) return null;
  if (callId && !idSchema.safeParse(callId).success) return null;
  let query = caller.admin
    .from("calls")
    .select(CALL_COLUMNS)
    .eq("callee_id", caller.userId)
    .eq("status", "ringing")
    .gte("created_at", new Date(Date.now() - RING_SECONDS * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (callId) query = query.eq("id", callId);
  const { data } = await query.maybeSingle();
  const call = data as CallRow | null;
  if (!call) return null;
  const person = await loadPerson(call.caller_id);
  if (!person) return null;
  return { id: call.id, kind: call.kind, from: { id: person.id, name: person.name, avatar: person.avatar } };
}
