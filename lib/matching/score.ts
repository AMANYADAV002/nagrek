import { dietCompatible, type FoodTier } from "@/lib/matching/food";
import type { Dietary, GeoPoint, Tone } from "@/lib/types";

/**
 * Matching weights (sum = 1). Food is the primary point of interest, then
 * physical distance, then conversation tone, then softer preferences.
 */
export const MATCH_WEIGHTS = {
  food: 0.4,
  distance: 0.25,
  tone: 0.15,
  dietary: 0.08,
  budget: 0.07,
  language: 0.05,
} as const;

/** Beyond this distance two people are not matched. */
export const MAX_DISTANCE_KM = 15;

export interface MatchProfile {
  foodInterests: string[];
  tone: Tone;
  city: string;
  point?: GeoPoint;
  dietary: Dietary;
  budget: [number, number];
  languages: string[];
}

export interface MatchResult {
  /** 0–100, rounded. 0 whenever `compatible` is false. */
  score: number;
  compatible: boolean;
  reason?: "tone" | "food" | "distance" | "dietary";
  distanceKm?: number;
  breakdown: Record<keyof typeof MATCH_WEIGHTS, number>;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Tone rule: a user who picked a specific tone only matches the same tone.
 * "random" (No preference) matches anyone.
 */
export function toneCompatible(a: Tone, b: Tone): boolean {
  return a === "random" || b === "random" || a === b;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function foodScore(a: string[], b: string[], craving?: string): number {
  const setB = new Set(b.map(norm));
  if (craving) return setB.has(norm(craving)) ? 1 : 0;
  const setA = new Set(a.map(norm));
  const shared = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : shared / union;
}

function dietaryScore(a: Dietary, b: Dietary): number {
  return a === b ? 1 : 0.75;
}

function budgetScore([aMin, aMax]: [number, number], [bMin, bMax]: [number, number]): number {
  const overlap = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  const span = Math.max(aMax, bMax) - Math.min(aMin, bMin);
  return span === 0 ? 1 : overlap / span;
}

function languageScore(a: string[], b: string[]): number {
  const setB = new Set(b.map(norm));
  return a.some((l) => setB.has(norm(l))) ? 1 : 0;
}

/**
 * Score how well `b` fits `a`. Hard filters (tone, shared food, distance)
 * make the pair incompatible; otherwise the weighted sum is returned.
 * Pass `craving` to score against a live request instead of saved interests.
 * Pass `tier` when the caller already decided the food relation, so a category
 * match such as paratha and chole bhature is not rejected as a different dish.
 */
export function matchingScore(a: MatchProfile, b: MatchProfile, opts: { craving?: string; tier?: FoodTier } = {}): MatchResult {
  const breakdown = { food: 0, distance: 0, tone: 0, dietary: 0, budget: 0, language: 0 };
  const fail = (reason: MatchResult["reason"], distanceKm?: number): MatchResult => ({
    score: 0, compatible: false, reason, distanceKm, breakdown,
  });

  // An exact live craving is shown even when tone or distance would normally reject the pair.
  // Diet stays a hard stop on every tier.
  const mutualCraving = opts.tier === "craving";
  if (!toneCompatible(a.tone, b.tone) && !mutualCraving) return fail("tone");
  if (!dietCompatible(a.dietary, b.dietary)) return fail("dietary");

  const tierFood = opts.tier === "craving" ? 1 : opts.tier === "saved" ? 0.85 : opts.tier === "category" ? 0.7 : 0;
  breakdown.food = opts.tier ? tierFood : foodScore(a.foodInterests, b.foodInterests, opts.craving);
  if (breakdown.food === 0) return fail("food");

  let distanceKm: number | undefined;
  if (a.point && b.point) {
    distanceKm = haversineKm(a.point, b.point);
    if (distanceKm > MAX_DISTANCE_KM && !mutualCraving) return fail("distance", distanceKm);
    breakdown.distance = distanceKm > MAX_DISTANCE_KM ? 0.15 : 1 - distanceKm / MAX_DISTANCE_KM;
  } else if (norm(a.city) === norm(b.city)) {
    breakdown.distance = 0.5;
  } else if (mutualCraving) {
    breakdown.distance = 0.2;
  } else {
    return fail("distance");
  }

  breakdown.tone = a.tone === b.tone ? 1 : mutualCraving ? 0.45 : 0.7;
  breakdown.dietary = dietaryScore(a.dietary, b.dietary);
  breakdown.budget = budgetScore(a.budget, b.budget);
  breakdown.language = languageScore(a.languages, b.languages);

  const total = (Object.keys(MATCH_WEIGHTS) as (keyof typeof MATCH_WEIGHTS)[]).reduce(
    (sum, k) => sum + MATCH_WEIGHTS[k] * breakdown[k],
    0,
  );
  return { score: Math.round(total * 100), compatible: true, distanceKm, breakdown };
}

/** Name used in the product brief. */
export const matching_score = matchingScore;

/** Rank candidates for a user, best first, dropping incompatible ones. */
export function rankCandidates<T extends MatchProfile>(me: MatchProfile, candidates: T[], craving?: string) {
  return candidates
    .map((c) => ({ candidate: c, result: matchingScore(me, c, { craving }) }))
    .filter((r) => r.result.compatible)
    .sort((x, y) => y.result.score - x.result.score);
}
