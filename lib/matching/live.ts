import { bestTier, dietCompatible, foodLevel } from "@/lib/matching/food";
import { mockUsers } from "@/lib/mock/users";
import { matchingScore, toneCompatible, type MatchProfile } from "@/lib/matching/score";
import type { MockUser, Preferences } from "@/lib/types";

/** Requests expire after this long unless matched or cancelled. */
export const REQUEST_TTL_MS = 15 * 60_000;
/** Below this many live candidates we fall back to "request to join" pings. */
export const LOW_TRAFFIC_THRESHOLD = 2;
/** Max people pinged per request, and per person per day. Enforced in lib/actions/matching.ts. */
export const MAX_JOIN_PINGS_PER_REQUEST = 5;
export const MAX_JOIN_PINGS_PER_USER_PER_DAY = 3;
/**
 * Live pre-meet window. Longer than the demo's 10 s because both people first have to
 * open the page; the blurred countdown shows whatever is left.
 */
export const MATCH_DECISION_MS = 45_000;

/** Demo only: stand-in for "users with an open match request right now". */
const ONLINE_IDS = new Set(["u-aisha", "u-rohan", "u-arjun", "u-kabir"]);

export function profileFromPreferences(p: Preferences): MatchProfile {
  return {
    foodInterests: p.foodInterests,
    tone: p.tone,
    city: p.location.city,
    point: p.location.point,
    dietary: p.dietary,
    budget: p.budget,
    languages: p.languages,
  };
}

function toProfile(u: MockUser): MatchProfile {
  return { foodInterests: u.foodInterests, tone: u.tone, city: u.city, point: u.point, dietary: u.dietary, budget: u.budget, languages: u.languages };
}

export function findLiveMatches(me: Preferences, craving: string, excluded: string[]) {
  const mine = profileFromPreferences(me);
  const pool = mockUsers.filter((u) => ONLINE_IDS.has(u.id) && !excluded.includes(u.id) && dietCompatible(me.dietary, u.dietary));
  const ranked = bestTier(
    pool.flatMap((u) => {
      const tier = foodLevel(craving, me.foodInterests, null, u.foodInterests);
      if (!tier) return [];
      const result = matchingScore(mine, toProfile(u), { craving, tier });
      if (!result.compatible) return [];
      return [{ tier, user: u, score: result.score, distanceKm: result.distanceKm }];
    }),
  ).sort((a, b) => b.score - a.score);
  return ranked.map((r) => ({ user: r.user, score: r.score, distanceKm: r.distanceKm }));
}

/**
 * Low-traffic rule: people whose *saved* interests include the craving
 * (online or not) and whose tone is compatible get a "request to join" ping.
 */
export function joinPingCandidates(me: Preferences, craving: string, excluded: string[]) {
  const ranked = bestTier(
    mockUsers.flatMap((u) => {
      if (excluded.includes(u.id) || !dietCompatible(me.dietary, u.dietary) || !toneCompatible(me.tone, u.tone)) return [];
      const tier = foodLevel(craving, me.foodInterests, null, u.foodInterests);
      return tier ? [{ tier, user: u }] : [];
    }),
  );
  return ranked.slice(0, MAX_JOIN_PINGS_PER_REQUEST).map((r) => r.user);
}
