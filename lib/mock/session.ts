"use client";

import { useSyncExternalStore } from "react";
import { defaultAvatar } from "@/lib/config/avatar-items";
import type { SessionSnapshot } from "@/lib/guards";
import type { StreakEvent } from "@/lib/streak/calc";
import type { AvatarConfig, Consent, PlanId, Preferences, Story } from "@/lib/types";

/**
 * Phase 1 mock session, persisted in localStorage so the whole flow can be
 * clicked through without a backend.
 * TODO(phase-2): replace with Supabase Auth + Postgres (profiles, user_preferences,
 * consents, subscriptions, follows, connections, wishlist_items, ...).
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
  avatar: AvatarConfig;
  ownedItems: string[];
  streakEvents: StreakEvent[];
  claimedRewards: { rewardId: string; claimedAt: string }[];
  wishlist: WishItem[];
  futurePlans: FuturePlan[];
  following: string[];
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

/** Seeds a streak ending yesterday, so it is valid at any time of day and today's meeting extends it. */
function seedStreakEvents(days: number): StreakEvent[] {
  const now = new Date();
  const count = Math.min(days, now.getDate() - 1);
  return Array.from({ length: count }, (_, i) => ({
    type: "meeting_completed" as const,
    at: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1 - i, 19).toISOString(),
  }));
}

export function initialSession(): SessionState {
  return {
    user: null,
    bio: "",
    preferences: null,
    consent: null,
    welcomed: false,
    plan: null,
    planSince: null,
    avatar: defaultAvatar,
    ownedItems: [],
    streakEvents: seedStreakEvents(6),
    claimedRewards: [],
    wishlist: [
      { id: "w1", kind: "place", title: "Third Wave Brewhouse", note: "Try the cold brew flight", sharedWith: [], createdAt: new Date().toISOString() },
      { id: "w2", kind: "food", title: "Hyderabadi biryani crawl", sharedWith: ["u-aisha"], createdAt: new Date().toISOString() },
    ],
    futurePlans: [],
    following: ["u-meera"],
    connections: { "u-meera": "accepted", "u-zara": "pending-in", "u-arjun": "pending-in" },
    blocked: [],
    muted: [],
    seenStories: [],
    myStories: [],
    reports: [],
    feedback: [],
    notificationsEnabled: true,
  };
}

let state: SessionState | null = null;
const listeners = new Set<() => void>();

function load(): SessionState {
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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled: the session still works for this tab.
  }
}

export function updateSession(updater: Partial<SessionState> | ((s: SessionState) => Partial<SessionState>)) {
  const current = load();
  const patch = typeof updater === "function" ? updater(current) : updater;
  if (Object.keys(patch).length === 0) return;
  state = { ...current, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function resetSession() {
  state = initialSession();
  persist();
  listeners.forEach((l) => l());
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
  return { signedIn: !!s.user, onboarded: !!s.preferences && !!s.consent?.adult, plan: s.plan };
}
