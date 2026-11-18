import type { SupabaseClient } from "@supabase/supabase-js";
import { accountFromRows } from "@/lib/db/map";
import type { SessionState } from "@/lib/mock/session";
import type { StreakEvent } from "@/lib/streak/calc";

export type AccountResult = { account: SessionState | null; error?: string };

/** Loads the signed-in account with whatever client holds the session (browser or server). */
export async function loadAccount(supabase: SupabaseClient): Promise<AccountResult> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    const missing = !authError || authError.name === "AuthSessionMissingError" || /session missing/i.test(authError.message);
    return missing ? { account: null } : { account: null, error: authError?.message };
  }

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

  const preferences = prefRes.data
    ? { ...prefRes.data, date_of_birth: String(prefRes.data.date_of_birth).slice(0, 10) }
    : null;

  return {
    account: accountFromRows({
      email: user.email ?? "",
      profile: profileRes.data,
      preferences,
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
