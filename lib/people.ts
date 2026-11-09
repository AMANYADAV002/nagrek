import "server-only";
import { defaultAvatar } from "@/lib/config/avatar-items";
import { getMockUser } from "@/lib/mock/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AvatarConfig, MockUser, Tone } from "@/lib/types";

/**
 * A person as other users see them. Shares the MockUser shape so every screen renders demo
 * and real people the same way. Only public columns are read: never coordinates, date of
 * birth, dietary or budget (those stay in user_preferences and are used server-side only).
 */
export type Person = MockUser;

const PUBLIC_COLUMNS = "id, name, handle, bio, city, area, tone, food_interests, avatar, trust_score, suspended";

interface PublicRow {
  id: string;
  name: string;
  handle: string;
  bio: string;
  city: string | null;
  area: string | null;
  tone: Tone | null;
  food_interests: string[];
  avatar: AvatarConfig | null;
  trust_score: number | string;
  suspended: boolean;
}

function toPerson(row: PublicRow, streak = 0, counts = { followers: 0, following: 0, connections: 0 }): Person {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    bio: row.bio,
    city: row.city ?? "",
    area: row.area ?? "",
    // Not public. Neutral values so shared components render; matching never reads these.
    point: { lat: 0, lng: 0 },
    dietary: "non-veg",
    budget: [0, 0],
    languages: [],
    plan: "plus",
    foodInterests: row.food_interests ?? [],
    tone: row.tone ?? "random",
    trustScore: Number(row.trust_score),
    streak,
    avatar: row.avatar ?? defaultAvatar,
    ...counts,
  };
}

/** Public cards for many people at once. Suspended people are left out. Demo ids resolve to demo people. */
export async function loadPeople(ids: string[]): Promise<Person[]> {
  const unique = [...new Set(ids)];
  const demo = unique.map((id) => getMockUser(id)).filter((u): u is MockUser => !!u);
  const real = unique.filter((id) => !getMockUser(id));
  const admin = getSupabaseAdminClient();
  if (!admin || real.length === 0) return demo;

  const [{ data: rows }, { data: streaks }] = await Promise.all([
    admin.from("profiles").select(PUBLIC_COLUMNS).in("id", real.slice(0, 200)),
    admin.from("streaks").select("user_id, current_count").in("user_id", real.slice(0, 200)),
  ]);
  const streakOf = new Map((streaks ?? []).map((s) => [s.user_id as string, s.current_count as number]));
  return [
    ...demo,
    ...((rows ?? []) as PublicRow[]).filter((r) => !r.suspended).map((r) => toPerson(r, streakOf.get(r.id) ?? 0)),
  ];
}

/** One public profile with follower, following and connection counts. */
export async function loadPerson(id: string): Promise<Person | null> {
  const demo = getMockUser(id);
  if (demo) return demo;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const [{ data: row }, { data: streak }, followers, following, connA, connB] = await Promise.all([
    admin.from("profiles").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle(),
    admin.from("streaks").select("current_count").eq("user_id", id).maybeSingle(),
    admin.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
    admin.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
    admin.from("connections").select("*", { count: "exact", head: true }).eq("requester_id", id).eq("status", "accepted"),
    admin.from("connections").select("*", { count: "exact", head: true }).eq("addressee_id", id).eq("status", "accepted"),
  ]);
  if (!row || (row as PublicRow).suspended) return null;
  return toPerson(row as PublicRow, streak?.current_count ?? 0, {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    connections: (connA.count ?? 0) + (connB.count ?? 0),
  });
}

/** Ids blocked in either direction, so neither person ever sees the other. */
export async function blockedEitherWay(userId: string): Promise<Set<string>> {
  const admin = getSupabaseAdminClient();
  if (!admin) return new Set();
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    admin.from("blocks").select("blocked_id").eq("blocker_id", userId),
    admin.from("blocks").select("blocker_id").eq("blocked_id", userId),
  ]);
  return new Set([...(mine ?? []).map((r) => r.blocked_id as string), ...(theirs ?? []).map((r) => r.blocker_id as string)]);
}
