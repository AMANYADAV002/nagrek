import { defaultAvatar, itemKey, type AvatarCategory } from "@/lib/config/avatar-items";
import type { ConnectionStatus, FuturePlan, SessionState, WishItem } from "@/lib/mock/session";
import { activePlan } from "@/lib/payments/plan-status";
import type { StreakEvent } from "@/lib/streak/calc";
import type { AvatarConfig, Consent, PlanId, Preferences } from "@/lib/types";
import { roundCoord } from "@/lib/validation/onboarding";
import type { OnboardingInput } from "@/lib/validation/onboarding";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Demo people use ids like `u-aisha`, which are not database users. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

export interface PreferenceRow {
  user_id: string;
  food_interests: string[];
  tone: string;
  city: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  dietary: string;
  budget_min: number;
  budget_max: number;
  group_size: string;
  time_slots: string[];
  languages: string[];
  topics: string[];
  goals: string[];
  date_of_birth: string;
}

/** Private row. Coordinates are rounded again here, even if the client already did it. */
export function preferencesRow(userId: string, input: OnboardingInput): PreferenceRow {
  return {
    user_id: userId,
    food_interests: input.foodInterests,
    tone: input.tone,
    city: input.location.city.trim(),
    area: input.location.area?.trim() || null,
    lat: input.location.point ? roundCoord(input.location.point.lat) : null,
    lng: input.location.point ? roundCoord(input.location.point.lng) : null,
    dietary: input.dietary,
    budget_min: input.budget[0],
    budget_max: input.budget[1],
    group_size: input.groupSize,
    time_slots: input.timeSlots,
    languages: input.languages,
    topics: input.topics,
    goals: input.goals,
    date_of_birth: input.dateOfBirth,
  };
}

/** Columns other people are allowed to see. No coordinates, no date of birth. */
export function publicProfilePatch(input: OnboardingInput) {
  return {
    city: input.location.city.trim(),
    area: input.location.area?.trim() || null,
    tone: input.tone,
    food_interests: input.foodInterests,
  };
}

interface ProfileRow {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatar: AvatarConfig;
  plan_id: PlanId | null;
  plan_since: string | null;
  plan_expires_at: string | null;
  onboarded_at: string | null;
  notifications_enabled: boolean;
}

interface ConnectionRow {
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
}

interface WishRow {
  id: string;
  kind: WishItem["kind"];
  title: string;
  note: string | null;
  created_at: string;
  wishlist_shares: { shared_with: string }[] | null;
}

interface PlanRow {
  id: string;
  wish_id: string | null;
  title: string;
  meet_at: string;
  place: string;
  plan_invites: { invitee_id: string }[] | null;
}

export function accountFromRows(input: {
  email: string;
  profile: ProfileRow;
  preferences: PreferenceRow | null;
  consent: Consent | null;
  following: string[];
  followers?: number;
  connections: ConnectionRow[];
  blocked: string[];
  muted: string[];
  wishes: WishRow[];
  plans: PlanRow[];
  inventory?: { category: string; item_id: string }[];
  streakEvents?: StreakEvent[];
}): SessionState {
  const plan = activePlan(input.profile.plan_id, input.profile.plan_expires_at);
  const preferences: Preferences | null = input.preferences
    ? {
        foodInterests: input.preferences.food_interests,
        tone: input.preferences.tone as Preferences["tone"],
        location: {
          city: input.preferences.city,
          area: input.preferences.area ?? undefined,
          point:
            input.preferences.lat != null && input.preferences.lng != null
              ? { lat: Number(input.preferences.lat), lng: Number(input.preferences.lng) }
              : undefined,
        },
        dietary: input.preferences.dietary as Preferences["dietary"],
        budget: [input.preferences.budget_min, input.preferences.budget_max],
        groupSize: input.preferences.group_size as Preferences["groupSize"],
        timeSlots: input.preferences.time_slots,
        languages: input.preferences.languages,
        topics: input.preferences.topics,
        goals: input.preferences.goals,
        dateOfBirth: input.preferences.date_of_birth,
      }
    : null;

  const connections: Record<string, ConnectionStatus> = {};
  for (const row of input.connections) {
    if (row.status === "rejected") continue;
    const mine = row.requester_id === input.profile.id;
    const other = mine ? row.addressee_id : row.requester_id;
    connections[other] = row.status === "accepted" ? "accepted" : mine ? "pending-out" : "pending-in";
  }

  const wishlist: WishItem[] = input.wishes.map((w) => ({
    id: w.id,
    kind: w.kind,
    title: w.title,
    note: w.note ?? undefined,
    sharedWith: (w.wishlist_shares ?? []).map((s) => s.shared_with),
    createdAt: w.created_at,
  }));

  const futurePlans: FuturePlan[] = input.plans.map((p) => ({
    id: p.id,
    wishId: p.wish_id ?? undefined,
    title: p.title,
    date: p.meet_at,
    place: p.place,
    invitees: (p.plan_invites ?? []).map((i) => i.invitee_id),
  }));

  return {
    user: { id: input.profile.id, name: input.profile.name, email: input.email, handle: input.profile.handle },
    bio: input.profile.bio,
    preferences,
    consent: input.consent,
    welcomed: !!input.profile.onboarded_at,
    plan,
    planSince: plan ? input.profile.plan_since : null,
    planExpiresAt: plan ? input.profile.plan_expires_at : null,
    avatar: input.profile.avatar ?? defaultAvatar,
    ownedItems: (input.inventory ?? []).map((i) => itemKey({ category: i.category as AvatarCategory, id: i.item_id })),
    streakEvents: input.streakEvents ?? [],
    claimedRewards: [],
    wishlist,
    futurePlans,
    following: input.following,
    followers: input.followers ?? 0,
    connections,
    blocked: input.blocked,
    muted: input.muted,
    seenStories: [],
    myStories: [],
    reports: [],
    feedback: [],
    notificationsEnabled: input.profile.notifications_enabled,
  };
}
