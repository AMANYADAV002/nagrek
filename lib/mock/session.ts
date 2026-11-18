"use client";

import { useSyncExternalStore } from "react";
import { defaultAvatar } from "@/lib/config/avatar-items";
import type { SessionSnapshot } from "@/lib/guards";
import { backendEnabled } from "@/lib/supabase/env";
import type { StreakEvent } from "@/lib/streak/calc";
import type { AvatarConfig, Consent, PlanId, Preferences, Story } from "@/lib/types";

/**
 * Client session. Without Supabase env vars this is the Phase 1 demo, stored
 * in localStorage. With env vars, AccountSync fills it from Postgres and
 * nothing is written to localStorage.
 */
export interface WishItem {
  id: string;
  kind: "place" | "food" | "idea";
  title: string;
  note?: string;
  sharedWith: string[];
  createdAt: string;
}

export interface FuturePlan {
  id: string;
  wishId?: string;
  title: string;
  date: string;
  place: string;
  invitees: string[];
}

export type ConnectionStatus = "pending-out" | "pending-in" | "accepted";

export interface ReportRecord {
  id: string;
  targetType: "user" | "story" | "meeting";
  targetId: string;
  reason: string;
  details?: string;
  createdAt: string;
}

export interface FeedbackRecord {
  meetingId: string;
  partnerId: string;
  rating: number;
  tags: string[];
  text?: string;
  createdAt: string;
}

export interface SessionState {
  user: { id: string; name: string; email: string; handle: string } | null;
  bio: string;
  preferences: Preferences | null;
  consent: Consent | null;
  welcomed: boolean;
  plan: PlanId | null;
  planSince: string | null;
  /** Null in the demo, where plans do not expire. */
  planExpiresAt: string | null;
  avatar: AvatarConfig;
  ownedItems: string[];
  streakEvents: StreakEvent[];
  claimedRewards: { rewardId: string; claimedAt: string }[];
  wishlist: WishItem[];
  futurePlans: FuturePlan[];
  following: string[];
  /** Missing in demo sessions saved before this field existed. */
  followers?: number;
  connections: Record<string, ConnectionStatus>;
  blocked: string[];
  muted: string[];
  seenStories: string[];
  myStories: Story[];
  reports: ReportRecord[];
  feedback: FeedbackRecord[];
  notificationsEnabled: boolean;
}

const STORAGE_KEY = "nagrek.session.v1";
const CACHE_KEY = "nagrek.session.cache.v1";

/** Seeds a streak ending yesterday, so it is valid at any time of day and today's meeting extends it. */
function seedStreakEvents(days: number): StreakEvent[] {
  const now = new Date();
  const count = Math.min(days, now.getDate() - 1);
  return Array.from({ length: count }, (_, i) => ({
    type: "meeting_completed" as const,
    at: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1 - i, 19).toISOString(),
  }));
}

/** Empty account. Used for real Supabase users and for signed-out state. */
export function blankSession(): SessionState {
  return {
    user: null,
    bio: "",
    preferences: null,
    consent: null,
    welcomed: false,
    plan: null,
    planSince: null,
    planExpiresAt: null,
    avatar: defaultAvatar,
    ownedItems: [],
    streakEvents: [],
    claimedRewards: [],
    wishlist: [],
    futurePlans: [],
    following: [],
    connections: {},
    blocked: [],
    muted: [],
    seenStories: [],
    myStories: [],
    reports: [],
    feedback: [],
    notificationsEnabled: true,
  };
}

/** Demo session, with a streak and a few people so the prototype is clickable. */
export function initialSession(): SessionState {
  return {
    ...blankSession(),
    streakEvents: seedStreakEvents(6),
    wishlist: [
      { id: "w1", kind: "place", title: "Third Wave Brewhouse", note: "Try the cold brew flight", sharedWith: [], createdAt: new Date().toISOString() },
      { id: "w2", kind: "food", title: "Hyderabadi biryani crawl", sharedWith: ["u-aisha"], createdAt: new Date().toISOString() },
    ],
    following: ["u-meera"],
    followers: 12,
    connections: { "u-meera": "accepted", "u-zara": "pending-in", "u-arjun": "pending-in" },
  };
}

/** A signed-in profile snapshot. Auth tokens stay in the Supabase cookie, not in this cache. */
export function parseCachedSession(raw: string): SessionState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v?: number; state?: Partial<SessionState> };
    if (parsed.v !== 1 || !parsed.state || typeof parsed.state !== "object") return null;
    return { ...blankSession(), ...parsed.state };
  } catch {
    return null;
  }
}

let state: SessionState | null = null;
let hydrated = false;
let epoch = 0;
const listeners = new Set<() => void>();

/** Bumps on every session change, so an older account fetch cannot overwrite a newer login. */
export function sessionEpoch() {
  return epoch;
}

function load(): SessionState | null {
  // Real accounts are loaded by AccountSync. A local snapshot paints first so reload and Back
  // do not blank the profile while that request is in flight.
  if (backendEnabled()) {
    if (state) return state;
    if (!hydrated && typeof window !== "undefined") {
      const cached = parseCachedSession(localStorage.getItem(CACHE_KEY) ?? "");
      if (cached) {
        state = cached;
        hydrated = true;
        return state;
      }
    }
    return hydrated ? state : null;
  }
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? { ...initialSession(), ...(JSON.parse(raw) as Partial<SessionState>) } : initialSession();
  } catch {
    state = initialSession();
  }
  return state;
}

function persist() {
  if (!state || typeof window === "undefined") return;
  try {
    if (backendEnabled()) {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, state }));
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled: the session still works for this tab.
  }
}

function emit(next: SessionState) {
  state = next;
  hydrated = true;
  epoch += 1;
  persist();
  listeners.forEach((l) => l());
}

export function updateSession(updater: Partial<SessionState> | ((s: SessionState) => Partial<SessionState>)) {
  const current = (backendEnabled() ? state ?? blankSession() : load()) ?? blankSession();
  const patch = typeof updater === "function" ? updater(current) : updater;
  if (Object.keys(patch).length === 0) return;
  emit({ ...current, ...patch });
}

/** Replace the in-memory session with the account loaded from Supabase. */
export function hydrateSession(next: SessionState) {
  emit(next);
}

export function peekSession() {
  return state;
}

export function resetSession() {
  emit(backendEnabled() ? blankSession() : initialSession());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns null during SSR/hydration, then the persisted session. */
export function useSession(): SessionState | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

export function snapshotOf(s: SessionState): SessionSnapshot {
  return { signedIn: !!s.user, onboarded: s.welcomed || (!!s.preferences && !!s.consent?.adult), plan: s.plan };
}
