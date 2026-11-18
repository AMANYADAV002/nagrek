"use server";

import { z } from "zod";
import {
  LOW_TRAFFIC_THRESHOLD, MAX_JOIN_PINGS_PER_REQUEST, MAX_JOIN_PINGS_PER_USER_PER_DAY, MATCH_DECISION_MS, REQUEST_TTL_MS,
} from "@/lib/matching/live";
import { dietCompatible, FOOD_TIER_ORDER, foodLevel, type FoodTier } from "@/lib/matching/food";
import { matchingScore, toneCompatible, type MatchProfile } from "@/lib/matching/score";
import { blockedEitherWay, loadPeople, loadPerson, type Person } from "@/lib/people";
import { connectMatchedPair } from "@/lib/server/relationship";
import { getCaller, getMember, startOfIndianDay, type Fail } from "@/lib/server/caller";
import { kycEnforced } from "@/lib/kyc/mode";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import type { Dietary, Tone } from "@/lib/types";

export interface Quota {
  used: number;
  limit: number | null;
}

export interface Candidate {
  requestId: string;
  person: Person;
  score: number;
  /** Whole kilometres, never coordinates. */
  distanceKm?: number;
}

export type CravingResult =
  | { ok: true; requestId: string; expiresAt: string; matches: Candidate[]; pinged: number; quota: Quota; via: FoodTier | null }
  | Fail;

export type MatchStatus = "pending" | "live" | "ended" | "skipped";
export type Decision = "pending" | "accepted" | "skipped";

export interface MatchView {
  id: string;
  food: string;
  role: "a" | "b";
  status: MatchStatus;
  mine: Decision;
  theirs: Decision;
  decideBy: string;
  partner: Person;
}

interface PrefRow {
  user_id: string;
  food_interests: string[];
  tone: Tone;
  city: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  dietary: Dietary;
  budget_min: number;
  budget_max: number;
  languages: string[];
}

const PREF_COLUMNS = "user_id, food_interests, tone, city, area, lat, lng, dietary, budget_min, budget_max, languages";
const foodSchema = z.string().trim().min(2).max(40);
const idSchema = z.uuid();

function toMatchProfile(p: PrefRow, override: { food?: string; tone?: Tone; lat?: number | null; lng?: number | null } = {}): MatchProfile {
  const lat = override.lat !== undefined ? override.lat : p.lat;
  const lng = override.lng !== undefined ? override.lng : p.lng;
  return {
    foodInterests: override.food ? [...new Set([override.food, ...p.food_interests])] : p.food_interests,
    tone: override.tone ?? p.tone,
    city: p.city,
    point: lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : undefined,
    dietary: p.dietary,
    budget: [p.budget_min, p.budget_max],
    languages: p.languages,
  };
}

async function quotaFor(admin: NonNullable<Awaited<ReturnType<typeof getCaller>>>["admin"], userId: string, plan: string): Promise<Quota> {
  const [{ data: row }, { count }] = await Promise.all([
    admin.from("plans").select("daily_matches").eq("id", plan).single(),
    admin.from("match_requests").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfIndianDay()),
  ]);
  return { used: count ?? 0, limit: row?.daily_matches ?? null };
}

export async function getMatchQuota(): Promise<Quota | null> {
  const m = await getMember();
  if ("error" in m) return null;
  return quotaFor(m.admin, m.userId, m.plan);
}

/** Posts a craving, returns scored live matches, and pings saved fans of that food when it is quiet. */
export async function postCraving(rawFood: string): Promise<CravingResult> {
  const food = foodSchema.safeParse(rawFood);
  if (!food.success) return { ok: false, error: "Pick what you are craving" };
  const m = await getMember();
  if ("error" in m) return m;
  const { admin, userId } = m;
  if (rateLimited(`craving:${userId}`, 6, 60_000)) return SLOW_DOWN;
  if (kycEnforced()) {
    const { data: kyc } = await admin.from("kyc_verifications").select("status").eq("user_id", userId).maybeSingle();
    if (kyc?.status !== "verified") return { ok: false, error: "Verify your identity before matching." };
  }

  const quota = await quotaFor(admin, userId, m.plan);
  if (quota.limit !== null && quota.used >= quota.limit) {
    return { ok: false, error: `You have used all ${quota.limit} matches today. Upgrade for more.` };
  }

  const { data: me } = await admin.from("user_preferences").select(PREF_COLUMNS).eq("user_id", userId).maybeSingle<PrefRow>();
  if (!me) return { ok: false, error: "Finish onboarding first" };

  await admin.from("match_requests").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "open");
  const { data: request, error } = await admin
    .from("match_requests")
    .insert({
      user_id: userId,
      food: food.data,
      tone: me.tone,
      city: me.city,
      area: me.area,
      lat: me.lat,
      lng: me.lng,
      expires_at: new Date(Date.now() + REQUEST_TTL_MS).toISOString(),
    })
    .select("id, expires_at")
    .single();
  if (error || !request) return { ok: false, error: error?.message ?? "Could not post your craving" };

  const blocked = await blockedEitherWay(userId);
  const { data: open } = await admin
    .from("match_requests")
    .select("id, user_id, food, tone, lat, lng")
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(150);

  const latest = new Map<string, { id: string; user_id: string; food: string; tone: Tone; lat: number | null; lng: number | null }>();
  for (const r of open ?? []) if (!blocked.has(r.user_id) && !latest.has(r.user_id)) latest.set(r.user_id, r);

  const scored: { tier: FoodTier; requestId: string; userId: string; score: number; distanceKm?: number }[] = [];
  if (latest.size) {
    const { data: prefs } = await admin.from("user_preferences").select(PREF_COLUMNS).in("user_id", [...latest.keys()]);
    const mine = toMatchProfile(me);
    for (const p of (prefs ?? []) as PrefRow[]) {
      const r = latest.get(p.user_id)!;
      const tier = foodLevel(food.data, me.food_interests, r.food, p.food_interests);
      if (!tier || !dietCompatible(me.dietary, p.dietary)) continue;
      const result = matchingScore(mine, toMatchProfile(p, { food: r.food, tone: r.tone, lat: r.lat, lng: r.lng }), { craving: food.data, tier });
      if (!result.compatible) continue;
      scored.push({
        tier,
        requestId: r.id,
        userId: p.user_id,
        score: result.score,
        distanceKm: result.distanceKm === undefined ? undefined : Math.max(1, Math.round(result.distanceKm)),
      });
    }
  }
  const offline = await peopleByFoodTier({ admin, userId, me, food: food.data, skip: blocked });
  const tier = FOOD_TIER_ORDER.find((t) => scored.some((s) => s.tier === t) || offline.some((s) => s.tier === t));
  const top = (tier ? scored.filter((s) => s.tier === tier) : []).sort((a, b) => b.score - a.score).slice(0, 10);
  const people = new Map((await loadPeople(top.map((s) => s.userId))).map((p) => [p.id, p]));
  const matches: Candidate[] = top
    .filter((s) => people.has(s.userId))
    .map((s) => ({ requestId: s.requestId, person: people.get(s.userId)!, score: s.score, distanceKm: s.distanceKm }));

  let pinged = 0;
  if (tier && matches.length < LOW_TRAFFIC_THRESHOLD) {
    const shown = new Set(matches.map((x) => x.person.id));
    pinged = await pingUsers({
      admin,
      requestId: request.id,
      food: food.data,
      area: me.area ?? me.city,
      tone: me.tone,
      userIds: offline.filter((s) => s.tier === tier && !shown.has(s.id)).map((s) => s.id),
    });
  }

  return {
    ok: true,
    requestId: request.id,
    expiresAt: request.expires_at,
    matches,
    pinged,
    via: tier ?? null,
    quota: { ...quota, used: quota.used + 1 },
  };
}

/** People in the same city, tagged with the food tier their saved list reaches. Diet and tone already applied. */
async function peopleByFoodTier(input: {
  admin: NonNullable<Awaited<ReturnType<typeof getCaller>>>["admin"];
  userId: string;
  me: PrefRow;
  food: string;
  skip: Set<string>;
}): Promise<{ tier: FoodTier; id: string }[]> {
  const { admin, userId, me, food, skip } = input;
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("user_id, food_interests, tone, dietary")
    .ilike("city", me.city)
    .neq("user_id", userId)
    .limit(80);
  const tagged = ((prefs ?? []) as Pick<PrefRow, "user_id" | "food_interests" | "tone" | "dietary">[]).flatMap((p) => {
    if (skip.has(p.user_id) || !dietCompatible(me.dietary, p.dietary) || !toneCompatible(me.tone, p.tone)) return [];
    const tier = foodLevel(food, me.food_interests, null, p.food_interests);
    if (!tier || tier === "craving") return [];
    return [{ tier, id: p.user_id }];
  });
  if (!tagged.length) return [];

  const { data: fans } = await admin
    .from("profiles")
    .select("id")
    .in("id", tagged.map((r) => r.id))
    .eq("notifications_enabled", true)
    .eq("suspended", false)
    .not("onboarded_at", "is", null)
    .gt("plan_expires_at", new Date().toISOString());
  const allowed = new Set((fans ?? []).map((f) => f.id));
  return tagged.filter((r) => allowed.has(r.id));
}

async function pingUsers(input: {
  admin: NonNullable<Awaited<ReturnType<typeof getCaller>>>["admin"];
  requestId: string;
  food: string;
  area: string;
  tone: Tone;
  userIds: string[];
}): Promise<number> {
  const { admin, requestId, food, area, tone, userIds } = input;
  if (!userIds.length) return 0;
  const { data: today } = await admin
    .from("notifications")
    .select("user_id")
    .eq("kind", "join_request")
    .gte("created_at", startOfIndianDay())
    .in("user_id", userIds);
  const sent = new Map<string, number>();
  for (const n of today ?? []) sent.set(n.user_id, (sent.get(n.user_id) ?? 0) + 1);
  const targets = userIds.filter((id) => (sent.get(id) ?? 0) < MAX_JOIN_PINGS_PER_USER_PER_DAY).slice(0, MAX_JOIN_PINGS_PER_REQUEST);
  if (!targets.length) return 0;
  const { error } = await admin.from("notifications").insert(
    targets.map((id) => ({ user_id: id, kind: "join_request", payload: { requestId, food, area, tone } })),
  );
  return error ? 0 : targets.length;
}

export async function cancelCraving(): Promise<{ ok: boolean }> {
  const caller = await getCaller();
  if (!caller) return { ok: false };
  await caller.admin.from("match_requests").update({ status: "cancelled" }).eq("user_id", caller.userId).eq("status", "open");
  return { ok: true };
}

async function createMatch(
  admin: NonNullable<Awaited<ReturnType<typeof getCaller>>>["admin"],
  input: { userA: string; userB: string; food: string; requestId: string },
) {
  const { data, error } = await admin
    .from("matches")
    .insert({
      user_a: input.userA,
      user_b: input.userB,
      food: input.food,
      request_id: input.requestId,
      decide_by: new Date(Date.now() + MATCH_DECISION_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the match");
  return data.id as string;
}

/** Claims someone's open request. Only one person can claim it; everyone else gets "just taken". */
async function claimRequest(admin: NonNullable<Awaited<ReturnType<typeof getCaller>>>["admin"], requestId: string, claimer: string) {
  const { data: request } = await admin.from("match_requests").select("user_id, food").eq("id", requestId).maybeSingle();
  if (!request || request.user_id === claimer) return null;
  const blocked = await blockedEitherWay(claimer);
  if (blocked.has(request.user_id)) return null;
  const { data: claimed } = await admin
    .from("match_requests")
    .update({ status: "matched" })
    .eq("id", requestId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .select("user_id, food")
    .maybeSingle();
  return claimed as { user_id: string; food: string } | null;
}

/** I pick someone from my live results. */
export async function proposeMatch(requestId: string): Promise<{ ok: true; matchId: string } | Fail> {
  if (!idSchema.safeParse(requestId).success) return { ok: false, error: "Invalid request" };
  const m = await getMember();
  if ("error" in m) return m;
  const { admin, userId } = m;

  const claimed = await claimRequest(admin, requestId, userId);
  if (!claimed) return { ok: false, error: "That person was just matched or their request expired." };

  const { data: mine } = await admin
    .from("match_requests")
    .update({ status: "matched" })
    .eq("user_id", userId)
    .eq("status", "open")
    .select("id")
    .limit(1);
  const matchId = await createMatch(admin, { userA: userId, userB: claimed.user_id, food: claimed.food, requestId: mine?.[0]?.id ?? requestId });
  await admin.from("notifications").insert({ user_id: claimed.user_id, kind: "match", payload: { matchId, food: claimed.food } });
  return { ok: true, matchId };
}

/** I accept a "someone nearby wants X" ping. */
export async function acceptJoin(notificationId: string): Promise<{ ok: true; matchId: string } | Fail> {
  if (!idSchema.safeParse(notificationId).success) return { ok: false, error: "Invalid notification" };
  const m = await getMember();
  if ("error" in m) return m;
  const { admin, userId } = m;

  const { data: note } = await admin
    .from("notifications")
    .select("payload")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("kind", "join_request")
    .maybeSingle();
  const requestId = (note?.payload as { requestId?: string } | null)?.requestId;
  await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", userId);
  if (!requestId) return { ok: false, error: "This request is no longer available." };

  const claimed = await claimRequest(admin, requestId, userId);
  if (!claimed) return { ok: false, error: "Someone else joined first, or the request expired." };

  const matchId = await createMatch(admin, { userA: claimed.user_id, userB: userId, food: claimed.food, requestId });
  await admin.from("notifications").insert({ user_id: claimed.user_id, kind: "join_accepted", payload: { matchId, food: claimed.food } });
  return { ok: true, matchId };
}

/** The pre-meet state for a participant. Returns null for anyone else. */
export async function getMatchView(matchId: string): Promise<MatchView | null> {
  if (!idSchema.safeParse(matchId).success) return null;
  const caller = await getCaller();
  if (!caller) return null;
  const { data: match } = await caller.supabase
    .from("matches")
    .select("id, user_a, user_b, food, status, a_decision, b_decision, decide_by")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return null;
  const role = match.user_a === caller.userId ? "a" : "b";
  const partner = await loadPerson(role === "a" ? match.user_b : match.user_a);
  if (!partner) return null;
  return {
    id: match.id,
    food: match.food,
    role,
    status: match.status as MatchStatus,
    mine: (role === "a" ? match.a_decision : match.b_decision) as Decision,
    theirs: (role === "a" ? match.b_decision : match.a_decision) as Decision,
    decideBy: match.decide_by,
    partner,
  };
}

/** Light poll used as a fallback when Realtime is unavailable. */
export async function getMatchState(matchId: string): Promise<{ status: MatchStatus; mine: Decision; theirs: Decision } | null> {
  if (!idSchema.safeParse(matchId).success) return null;
  const caller = await getCaller();
  if (!caller) return null;
  const { data: m } = await caller.supabase
    .from("matches")
    .select("user_a, status, a_decision, b_decision")
    .eq("id", matchId)
    .maybeSingle();
  if (!m) return null;
  const a = m.user_a === caller.userId;
  return {
    status: m.status as MatchStatus,
    mine: (a ? m.a_decision : m.b_decision) as Decision,
    theirs: (a ? m.b_decision : m.a_decision) as Decision,
  };
}

/** Accept or skip during pre-meet. When both accept, the match goes live and a meeting is opened. */
export async function respondMatch(matchId: string, decision: "accepted" | "skipped"): Promise<{ ok: true; status: MatchStatus } | Fail> {
  if (!idSchema.safeParse(matchId).success || !["accepted", "skipped"].includes(decision)) return { ok: false, error: "Invalid request" };
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in to continue" };
  const { admin, userId } = caller;

  const { data: match } = await admin.from("matches").select("user_a, user_b, food, status, decide_by").eq("id", matchId).maybeSingle();
  if (!match || (match.user_a !== userId && match.user_b !== userId)) return { ok: false, error: "Match not found" };
  if (match.status !== "pending") return { ok: true, status: match.status as MatchStatus };

  const late = new Date(match.decide_by).getTime() < Date.now();
  const final = late ? "skipped" : decision;
  const column = match.user_a === userId ? "a_decision" : "b_decision";
  const otherId = match.user_a === userId ? match.user_b : match.user_a;
  if (final === "accepted") {
    await admin.from("notifications").insert({
      user_id: otherId,
      kind: "match_accepted",
      payload: { matchId, food: match.food },
    });
  }
  await admin
    .from("matches")
    .update({ [column]: final, ...(final === "skipped" ? { status: "skipped" } : {}) })
    .eq("id", matchId)
    .eq("status", "pending");

  const { data: after } = await admin.from("matches").select("status, a_decision, b_decision").eq("id", matchId).single();
  if (after?.status === "pending" && after.a_decision === "accepted" && after.b_decision === "accepted") {
    await admin.from("matches").update({ status: "live" }).eq("id", matchId).eq("status", "pending");
    await admin.from("meetings").upsert({ match_id: matchId }, { onConflict: "match_id", ignoreDuplicates: true });
    await connectMatchedPair(admin, match.user_a, match.user_b);
    return { ok: true, status: "live" };
  }
  return { ok: true, status: (after?.status ?? "pending") as MatchStatus };
}
