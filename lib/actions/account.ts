"use server";

import { TERMS_VERSION } from "@/lib/data/legal";
import { accountFromRows, isUuid, preferencesRow, publicProfilePatch } from "@/lib/db/map";
import type { Plan } from "@/lib/config/plans";
import type { AvatarConfig, PlanId } from "@/lib/types";
import type { SessionState } from "@/lib/mock/session";
import type { StreakEvent } from "@/lib/streak/calc";
import { blockedEitherWay } from "@/lib/people";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation/onboarding";

type Result = { ok: true; skipped?: boolean; id?: string } | { ok: false; error: string };

async function client() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { supabase: null, userId: null as string | null };
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

export async function loadMyAccount(): Promise<{ account: SessionState | null; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { account: null };
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { account: null };

  const streakSince = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const [profileRes, prefRes, consentRes, followRes, followerRes, connRes, blockRes, muteRes, wishRes, planRes, inventoryRes, streakRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, handle, bio, avatar, plan_id, plan_since, plan_expires_at, onboarded_at, notifications_enabled")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("consents").select("adult, respectful, terms_version, accepted_at").eq("user_id", user.id).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
    supabase.from("connections").select("requester_id, addressee_id, status").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
    supabase.from("mutes").select("muted_id").eq("user_id", user.id),
    supabase.from("wishlist_items").select("id, kind, title, note, created_at, wishlist_shares(shared_with)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("plans_future").select("id, wish_id, title, meet_at, place, plan_invites(invitee_id)").eq("user_id", user.id).order("meet_at"),
    supabase.from("user_avatar_inventory").select("category, item_id").eq("user_id", user.id),
    supabase.from("streak_events").select("type, at").eq("user_id", user.id).gte("at", streakSince).order("at"),
  ]);

  const failed = [profileRes, prefRes, consentRes, followRes, followerRes, connRes, blockRes, muteRes, wishRes, planRes, inventoryRes, streakRes].find((r) => r.error);
  if (failed?.error) return { account: null, error: failed.error.message };
  if (!profileRes.data) return { account: null, error: "Profile was not created. Check the signup trigger in the migration." };

  const consent = consentRes.data
    ? {
        adult: consentRes.data.adult,
        respectful: consentRes.data.respectful,
        termsVersion: consentRes.data.terms_version,
        acceptedAt: consentRes.data.accepted_at,
      }
    : null;

  return {
    account: accountFromRows({
      email: user.email ?? "",
      profile: profileRes.data,
      preferences: prefRes.data,
      consent,
      following: (followRes.data ?? []).map((r) => r.following_id),
      followers: followerRes.count ?? 0,
      connections: connRes.data ?? [],
      blocked: (blockRes.data ?? []).map((r) => r.blocked_id),
      muted: (muteRes.data ?? []).map((r) => r.muted_id),
      wishes: wishRes.data ?? [],
      plans: planRes.data ?? [],
      inventory: inventoryRes.data ?? [],
      streakEvents: (streakRes.data ?? []) as StreakEvent[],
    }),
  };
}

export async function loadPlans(): Promise<Plan[] | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("plans").select("*").order("rank");
  if (error || !data?.length) return null;
  return data.map((row) => ({
    id: row.id as PlanId,
    name: row.name,
    tagline: row.tagline,
    priceInr: row.price_inr,
    period: "month" as const,
    rank: row.rank,
    highlight: row.highlight,
    dailyMatches: row.daily_matches ?? "unlimited",
    music: row.music,
    priorityMatching: row.priority_matching,
    rewardTier: row.reward_tier as Plan["rewardTier"],
    perks: row.perks,
  }));
}

export async function saveOnboarding(raw: unknown): Promise<Result> {
  const { supabase, userId } = await client();
  if (!supabase) return { ok: true };
  if (!userId) return { ok: false, error: "Not signed in" };
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answers" };

  const pref = await supabase.from("user_preferences").upsert(preferencesRow(userId, parsed.data));
  if (pref.error) return { ok: false, error: pref.error.message };

  const consent = await supabase.from("consents").upsert(
    { user_id: userId, adult: true, respectful: true, terms_version: TERMS_VERSION },
    { onConflict: "user_id,terms_version" },
  );
  if (consent.error) return { ok: false, error: consent.error.message };

  const profile = await supabase.from("profiles").update(publicProfilePatch(parsed.data)).eq("id", userId);
  if (profile.error) return { ok: false, error: profile.error.message };

  const done = await supabase.rpc("complete_onboarding");
  if (done.error) return { ok: false, error: done.error.message };
  return { ok: true };
}

/** The database checks that every layer is free, bought, or unlocked before saving. */
export async function saveAvatar(avatar: AvatarConfig): Promise<Result> {
  const { supabase, userId } = await client();
  if (!supabase) return { ok: true };
  if (!userId) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.rpc("save_avatar", { p_avatar: avatar });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveProfile(patch: { bio?: string; notificationsEnabled?: boolean }): Promise<Result> {
  const { supabase, userId } = await client();
  if (!supabase) return { ok: true };
  if (!userId) return { ok: false, error: "Not signed in" };
  const row: { bio?: string; notifications_enabled?: boolean } = {};
  if (patch.bio !== undefined) row.bio = patch.bio.slice(0, 160);
  if (patch.notificationsEnabled !== undefined) row.notifications_enabled = patch.notificationsEnabled;
  const { error } = await supabase.from("profiles").update(row).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAccount(): Promise<Result> {
  const { supabase, userId } = await client();
  if (!supabase) return { ok: true };
  if (!userId) return { ok: false, error: "Not signed in" };
  // Story files are not linked to the account row, so remove them before the account goes.
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: files } = await admin.storage.from("stories").list(userId, { limit: 1000 });
    if (files?.length) await admin.storage.from("stories").remove(files.map((f) => `${userId}/${f.name}`));
  }
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut();
  return { ok: true };
}

function skipUnlessMember(id: string): Result | null {
  if (!isUuid(id)) return { ok: true, skipped: true };
  return null;
}

export async function setFollow(targetId: string, follow: boolean): Promise<Result> {
  const skipped = skipUnlessMember(targetId);
  if (skipped) return skipped;
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const query = follow
    ? supabase.from("follows").insert({ follower_id: userId, following_id: targetId })
    : supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
  const { error } = await query;
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendConnection(targetId: string): Promise<Result> {
  const skipped = skipUnlessMember(targetId);
  if (skipped) return skipped;
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  if ((await blockedEitherWay(userId)).has(targetId)) return { ok: false, error: "You can't connect with this person" };
  const { error } = await supabase.from("connections").insert({ requester_id: userId, addressee_id: targetId, status: "pending" });
  if (error) return { ok: false, error: error.message };
  await notify(userId, targetId, "connection_request");
  return { ok: true };
}

/** In-app notification from one member to another, carrying only the sender's display name. */
async function notify(fromId: string, toId: string, kind: "connection_request" | "connection_accepted") {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const { data: me } = await admin.from("profiles").select("name").eq("id", fromId).single();
  await admin.from("notifications").insert({ user_id: toId, kind, payload: { from: fromId, name: me?.name ?? "Someone" } });
}

export async function respondConnection(targetId: string, accept: boolean): Promise<Result> {
  const skipped = skipUnlessMember(targetId);
  if (skipped) return skipped;
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const { error } = await supabase
    .from("connections")
    .update({ status: accept ? "accepted" : "rejected" })
    .eq("requester_id", targetId)
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  if (accept) await notify(userId, targetId, "connection_accepted");
  return { ok: true };
}

export async function cancelConnection(targetId: string): Promise<Result> {
  const skipped = skipUnlessMember(targetId);
  if (skipped) return skipped;
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const { error } = await supabase.from("connections").delete().eq("requester_id", userId).eq("addressee_id", targetId).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setBlock(targetId: string, blocked: boolean): Promise<Result> {
  const skipped = skipUnlessMember(targetId);
  if (skipped) return skipped;
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  if (!blocked) {
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", targetId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const block = await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: targetId });
  if (block.error && !block.error.message.includes("duplicate")) return { ok: false, error: block.error.message };
  await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
  return { ok: true };
}

export async function setMute(targetId: string, muted: boolean): Promise<Result> {
  const skipped = skipUnlessMember(targetId);
  if (skipped) return skipped;
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const query = muted
    ? supabase.from("mutes").insert({ user_id: userId, muted_id: targetId })
    : supabase.from("mutes").delete().eq("user_id", userId).eq("muted_id", targetId);
  const { error } = await query;
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addWish(input: { kind: "place" | "food" | "idea"; title: string; note?: string }): Promise<Result> {
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({ user_id: userId, kind: input.kind, title: input.title.slice(0, 60), note: input.note?.slice(0, 140) ?? null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save" };
  return { ok: true, id: data.id };
}

export async function deleteWish(id: string): Promise<Result> {
  if (!isUuid(id)) return { ok: true, skipped: true };
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const { error } = await supabase.from("wishlist_items").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function shareWish(id: string, userIds: string[]): Promise<Result> {
  const ids = userIds.filter(isUuid);
  if (!isUuid(id) || ids.length === 0) return { ok: true, skipped: true };
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const { error } = await supabase.from("wishlist_shares").insert(ids.map((shared_with) => ({ item_id: id, shared_with })));
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addFuturePlan(input: { wishId?: string; title: string; date: string; place: string; invitees: string[] }): Promise<Result> {
  const { supabase, userId } = await client();
  if (!supabase || !userId) return { ok: true };
  const wishId = input.wishId && isUuid(input.wishId) ? input.wishId : null;
  const { data, error } = await supabase
    .from("plans_future")
    .insert({ user_id: userId, wish_id: wishId, title: input.title.slice(0, 60), meet_at: new Date(input.date).toISOString(), place: input.place.slice(0, 80) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save the plan" };
  const invitees = input.invitees.filter(isUuid);
  if (invitees.length) {
    const invites = await supabase.from("plan_invites").insert(invitees.map((invitee_id) => ({ plan_id: data.id, invitee_id })));
    if (invites.error) return { ok: false, error: invites.error.message };
  }
  return { ok: true, id: data.id };
}
