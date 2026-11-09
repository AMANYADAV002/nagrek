"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { loadPeople } from "@/lib/people";
import { getCaller, getMember, type Caller, type Fail } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { unreachableReason } from "@/lib/server/relationship";
import type { MockUser } from "@/lib/types";

/** Verification opens this long before the planned time and closes this long after. */
const OPEN_BEFORE_MS = 2 * 3_600_000;
const CLOSE_AFTER_MS = 6 * 3_600_000;
const MAX_OPEN_VISITS = 10;
const idSchema = z.uuid();

export type VisitStatus = "proposed" | "accepted" | "declined" | "cancelled" | "verified" | "expired";

export interface VisitView {
  id: string;
  partner: Pick<MockUser, "id" | "name" | "avatar">;
  iProposed: boolean;
  placeName: string;
  placeArea: string | null;
  note: string | null;
  scheduledAt: string;
  status: VisitStatus;
  verifiedAt: string | null;
  /** Inside the window where QR verification is allowed. */
  canVerify: boolean;
}

export interface VisitStreak {
  current: number;
  best: number;
  totalVerified: number;
  lastCountedAt: string | null;
}

interface VisitRow {
  id: string;
  proposer_id: string;
  invitee_id: string;
  place_name: string;
  place_area: string | null;
  note: string | null;
  scheduled_at: string;
  status: VisitStatus;
  verified_at: string | null;
}

const VISIT_COLUMNS = "id, proposer_id, invitee_id, place_name, place_area, note, scheduled_at, status, verified_at";

const ERRORS: Record<string, string> = {
  visit_not_found: "Visit not found.",
  already_verified: "This visit is already verified.",
  not_accepted: "Both of you need to confirm the visit first.",
  outside_window: "Verification opens 2 hours before the planned time and closes 6 hours after.",
  bad_location: "We couldn't read your location.",
  weak_gps: "Your location isn't precise enough. Step outside or turn on precise location, then try again.",
  stale_gps: "Your location is out of date. Try again.",
  impossible_travel: "Your location jumped too far, too fast. Turn off any location-changing apps and try again.",
  bad_token: "That code has expired or was already used. Ask them to show a fresh one.",
  own_code: "That's your own code. Scan the other person's code.",
  too_far: "You don't seem to be together. Stand next to each other and try again.",
};

function friendlyError(message: string) {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : "Something went wrong. Try again.";
}

function inWindow(scheduledAt: string, now = Date.now()) {
  const t = new Date(scheduledAt).getTime();
  return now >= t - OPEN_BEFORE_MS && now <= t + CLOSE_AFTER_MS;
}

async function notify(admin: Caller["admin"], userId: string, kind: string, payload: Record<string, string>) {
  await admin.from("notifications").insert({ user_id: userId, kind, payload });
}

async function nameOf(admin: Caller["admin"], userId: string) {
  const { data } = await admin.from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name ?? "Someone";
}

async function participantVisit(visitId: string) {
  if (!idSchema.safeParse(visitId).success) return null;
  const caller = await getCaller();
  if (!caller) return null;
  const { data } = await caller.admin.from("visits").select(VISIT_COLUMNS).eq("id", visitId).maybeSingle();
  const visit = data as VisitRow | null;
  if (!visit || (visit.proposer_id !== caller.userId && visit.invitee_id !== caller.userId)) return null;
  const partnerId = visit.proposer_id === caller.userId ? visit.invitee_id : visit.proposer_id;
  return { ...caller, visit, partnerId };
}

export async function loadVisits(): Promise<{ visits: VisitView[]; streak: VisitStreak } | null> {
  const caller = await getCaller();
  if (!caller) return null;
  const { admin, userId } = caller;

  // Plans whose window has passed without verification expire.
  await admin
    .from("visits")
    .update({ status: "expired" })
    .in("status", ["proposed", "accepted"])
    .lt("scheduled_at", new Date(Date.now() - CLOSE_AFTER_MS).toISOString())
    .or(`proposer_id.eq.${userId},invitee_id.eq.${userId}`);

  const [{ data: rows }, { data: streak }] = await Promise.all([
    admin
      .from("visits")
      .select(VISIT_COLUMNS)
      .or(`proposer_id.eq.${userId},invitee_id.eq.${userId}`)
      .order("scheduled_at", { ascending: false })
      .limit(60),
    admin.from("visit_streaks").select("current_count, best_count, total_verified, last_counted_at").eq("user_id", userId).maybeSingle(),
  ]);
  const visits = (rows ?? []) as VisitRow[];
  const people = new Map((await loadPeople(visits.map((v) => (v.proposer_id === userId ? v.invitee_id : v.proposer_id)))).map((p) => [p.id, p]));

  const lapsed = !streak?.last_counted_at || Date.now() - new Date(streak.last_counted_at).getTime() > 30 * 86_400_000;
  return {
    visits: visits.flatMap((v) => {
      const partner = people.get(v.proposer_id === userId ? v.invitee_id : v.proposer_id);
      if (!partner) return [];
      return [{
        id: v.id,
        partner: { id: partner.id, name: partner.name, avatar: partner.avatar },
        iProposed: v.proposer_id === userId,
        placeName: v.place_name,
        placeArea: v.place_area,
        note: v.note,
        scheduledAt: v.scheduled_at,
        status: v.status,
        verifiedAt: v.verified_at,
        canVerify: v.status === "accepted" && inWindow(v.scheduled_at),
      }];
    }),
    streak: {
      current: lapsed ? 0 : (streak?.current_count ?? 0),
      best: streak?.best_count ?? 0,
      totalVerified: streak?.total_verified ?? 0,
      lastCountedAt: streak?.last_counted_at ?? null,
    },
  };
}

const proposeSchema = z.object({
  inviteeId: z.uuid(),
  placeName: z.string().trim().min(2, "Add a place").max(120),
  placeArea: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
  scheduledAt: z.iso.datetime({ offset: true }),
  callId: z.uuid().optional(),
});

/** Plan an in-person visit with a connection, during or after a call. */
export async function proposeVisit(raw: unknown): Promise<{ ok: true; visitId: string } | Fail> {
  const parsed = proposeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid visit" };
  const input = parsed.data;
  const when = new Date(input.scheduledAt).getTime();
  if (when < Date.now() - 5 * 60_000) return { ok: false, error: "Pick a time in the future." };
  if (when > Date.now() + 60 * 86_400_000) return { ok: false, error: "Plan within the next 60 days." };

  const m = await getMember();
  if ("error" in m) return m;
  const { admin, userId } = m;
  if (rateLimited(`visit:${userId}`, 5, 60_000)) return SLOW_DOWN;
  const reason = await unreachableReason(admin, userId, input.inviteeId);
  if (reason) return { ok: false, error: reason };

  const { count } = await admin
    .from("visits")
    .select("*", { count: "exact", head: true })
    .in("status", ["proposed", "accepted"])
    .or(`proposer_id.eq.${userId},invitee_id.eq.${userId}`);
  if ((count ?? 0) >= MAX_OPEN_VISITS) return { ok: false, error: "You have a lot of open plans. Finish or cancel some first." };

  // Only link a call the two of them were actually on.
  let callId: string | null = null;
  if (input.callId) {
    const { data: call } = await admin.from("calls").select("caller_id, callee_id").eq("id", input.callId).maybeSingle();
    if (call && [call.caller_id, call.callee_id].includes(userId) && [call.caller_id, call.callee_id].includes(input.inviteeId)) callId = input.callId;
  }

  const { data, error } = await admin
    .from("visits")
    .insert({
      proposer_id: userId,
      invitee_id: input.inviteeId,
      call_id: callId,
      place_name: input.placeName,
      place_area: input.placeArea || null,
      note: input.note || null,
      scheduled_at: new Date(when).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save the plan" };
  await notify(admin, input.inviteeId, "visit_proposed", { visitId: data.id, from: userId, name: await nameOf(admin, userId), place: input.placeName, at: new Date(when).toISOString() });
  return { ok: true, visitId: data.id };
}

export async function respondVisit(visitId: string, accept: boolean): Promise<{ ok: true } | Fail> {
  const p = await participantVisit(visitId);
  if (!p || p.visit.invitee_id !== p.userId) return { ok: false, error: "Visit not found" };
  if (p.visit.status !== "proposed") return { ok: false, error: "This plan was already answered." };
  if (accept) {
    const reason = await unreachableReason(p.admin, p.userId, p.partnerId);
    if (reason) return { ok: false, error: reason };
  }
  const { data } = await p.admin
    .from("visits")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", visitId)
    .eq("status", "proposed")
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, error: "This plan was already answered." };
  await notify(p.admin, p.partnerId, accept ? "visit_accepted" : "visit_declined", { visitId, from: p.userId, name: await nameOf(p.admin, p.userId), place: p.visit.place_name });
  return { ok: true };
}

export async function cancelVisit(visitId: string): Promise<{ ok: true } | Fail> {
  const p = await participantVisit(visitId);
  if (!p) return { ok: false, error: "Visit not found" };
  const { data } = await p.admin
    .from("visits")
    .update({ status: "cancelled" })
    .eq("id", visitId)
    .in("status", ["proposed", "accepted"])
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, error: "This plan can't be cancelled any more." };
  await notify(p.admin, p.partnerId, "visit_cancelled", { visitId, from: p.userId, name: await nameOf(p.admin, p.userId), place: p.visit.place_name });
  return { ok: true };
}

const fixSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(10_000),
  at: z.number().int().positive(),
});
export type GpsFix = z.infer<typeof fixSchema>;

/**
 * A fresh single-use QR token for the person showing their code. Only its SHA-256 is stored.
 * The QR encodes `nagrek-visit:<visit id>:<token>`.
 */
export async function issueVisitCode(visitId: string, rawFix: unknown): Promise<{ ok: true; qr: string; expiresAt: string } | Fail> {
  const fix = fixSchema.safeParse(rawFix);
  if (!fix.success) return { ok: false, error: ERRORS.bad_location };
  const p = await participantVisit(visitId);
  if (!p) return { ok: false, error: "Visit not found" };
  if (rateLimited(`visit-code:${p.userId}`, 8, 60_000)) return SLOW_DOWN;

  const token = randomBytes(24).toString("base64url");
  const { data, error } = await p.admin.rpc("issue_visit_token", {
    p_visit: visitId,
    p_user: p.userId,
    p_token_hash: createHash("sha256").update(token).digest("hex"),
    p_lat: fix.data.lat,
    p_lng: fix.data.lng,
    p_acc: fix.data.accuracy,
    p_fixed_at: new Date(fix.data.at).toISOString(),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true, qr: `nagrek-visit:${visitId}:${token}`, expiresAt: data as string };
}

export interface ScanResult {
  state: "waiting_for_partner" | "verified";
  /** Only for the caller: whether this visit counted toward their streak, and any rewards unlocked. */
  counted?: boolean;
  reason?: "same_partner_this_week" | "daily_limit" | null;
  streak?: number;
  rewards?: string[];
}

/** Scan the other person's QR. When both have scanned each other, the visit is verified. */
export async function scanVisitCode(qr: string, rawFix: unknown): Promise<({ ok: true } & ScanResult) | Fail> {
  const match = /^nagrek-visit:([0-9a-f-]{36}):([A-Za-z0-9_-]{20,64})$/.exec(qr.trim());
  if (!match) return { ok: false, error: "That isn't a Nagrek visit code." };
  const [, visitId, token] = match;
  const fix = fixSchema.safeParse(rawFix);
  if (!fix.success) return { ok: false, error: ERRORS.bad_location };
  const p = await participantVisit(visitId);
  if (!p) return { ok: false, error: "This code is for a visit you're not part of." };
  if (rateLimited(`visit-scan:${p.userId}`, 10, 60_000)) return SLOW_DOWN;

  const { data, error } = await p.admin.rpc("record_visit_scan", {
    p_visit: visitId,
    p_scanner: p.userId,
    p_token_hash: createHash("sha256").update(token).digest("hex"),
    p_lat: fix.data.lat,
    p_lng: fix.data.lng,
    p_acc: fix.data.accuracy,
    p_fixed_at: new Date(fix.data.at).toISOString(),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  const result = data as { state: ScanResult["state"]; results?: { user: string; counted: boolean; reason: string | null; streak: number; rewards: string[] }[] };
  if (result.state !== "verified" || !result.results?.length) return { ok: true, state: result.state };

  // Tell both people. Reward codes stay on the streak page; notifications never carry them.
  const names = new Map([[p.userId, await nameOf(p.admin, p.userId)], [p.partnerId, await nameOf(p.admin, p.partnerId)]]);
  for (const r of result.results) {
    const other = r.user === p.userId ? p.partnerId : p.userId;
    await notify(p.admin, r.user, "visit_verified", { visitId, name: names.get(other) ?? "Your friend", streak: String(r.streak), counted: String(r.counted) });
    if (r.rewards.length) await notify(p.admin, r.user, "reward_unlocked", { count: String(r.rewards.length) });
  }
  const mine = result.results.find((r) => r.user === p.userId);
  return {
    ok: true,
    state: "verified",
    counted: mine?.counted,
    reason: (mine?.reason as ScanResult["reason"]) ?? null,
    streak: mine?.streak,
    rewards: mine?.rewards ?? [],
  };
}

/** Polled by both phones during verification. */
export async function getVisitProgress(visitId: string): Promise<{ status: VisitStatus; iScanned: boolean; partnerScanned: boolean } | null> {
  const p = await participantVisit(visitId);
  if (!p) return null;
  const { data: scans } = await p.admin.from("visit_scans").select("scanner_id, scanned_at").eq("visit_id", visitId);
  const recent = (scans ?? []).filter((s) => Date.now() - new Date(s.scanned_at).getTime() < 10 * 60_000);
  return {
    status: p.visit.status,
    iScanned: recent.some((s) => s.scanner_id === p.userId),
    partnerScanned: recent.some((s) => s.scanner_id === p.partnerId),
  };
}
