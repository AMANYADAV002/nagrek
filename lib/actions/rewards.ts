"use server";

import { z } from "zod";
import type { Reward, Sponsor } from "@/lib/mock/rewards";
import { getCaller, getMember, type Fail } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { currentStreakMonth, refreshStreak } from "@/lib/streak/server";
import type { PlanId } from "@/lib/types";

export interface RewardsData {
  rewards: Reward[];
  sponsors: Sponsor[];
  /** Only the caller's own claims, with the codes they were issued. */
  claimed: { rewardId: string; claimedAt: string; code: string | null }[];
}

export async function loadRewards(): Promise<RewardsData | null> {
  const caller = await getCaller();
  if (!caller) return null;
  const { admin, supabase, userId } = caller;
  const [{ data: rewards }, { data: sponsors }, { data: mine }] = await Promise.all([
    supabase.from("rewards").select("*").order("min_streak"),
    supabase.from("sponsors").select("*"),
    admin.from("user_rewards").select("reward_id, claimed_at, reward_codes(code)").eq("user_id", userId),
  ]);
  return {
    rewards: (rewards ?? []).map((r) => ({
      id: r.id,
      sponsorId: r.sponsor_id,
      title: r.title,
      description: r.description,
      minStreak: r.min_streak,
      minPlan: r.min_plan as PlanId,
      expiresAt: r.expires_at,
      stock: r.stock,
    })),
    sponsors: (sponsors ?? []) as Sponsor[],
    claimed: (mine ?? []).map((c) => {
      const code = c.reward_codes as unknown as { code: string } | { code: string }[] | null;
      return {
        rewardId: c.reward_id,
        claimedAt: c.claimed_at,
        code: (Array.isArray(code) ? code[0]?.code : code?.code) ?? null,
      };
    }),
  };
}

const CLAIM_ERRORS: Record<string, string> = {
  reward_not_found: "That reward no longer exists.",
  expired: "This reward has expired.",
  already_claimed: "You already claimed this reward.",
  not_allowed: "Your account can't claim rewards right now.",
  plan: "Your plan doesn't include this reward.",
  streak: "Your streak isn't long enough yet.",
  out_of_stock: "This reward just ran out.",
};

/** Issues one unused code from the pool. The code goes only to the person who claimed it. */
export async function claimReward(rewardId: string): Promise<{ ok: true; code: string } | Fail> {
  if (!z.string().min(1).max(40).safeParse(rewardId).success) return { ok: false, error: "Invalid reward" };
  const m = await getMember();
  if ("error" in m) return m;
  if (rateLimited(`claim:${m.userId}`, 5, 60_000)) return SLOW_DOWN;
  await refreshStreak(m.admin, m.userId);
  const { data, error } = await m.admin.rpc("claim_reward", { p_user: m.userId, p_reward: rewardId });
  if (error) {
    const key = Object.keys(CLAIM_ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: key ? CLAIM_ERRORS[key] : "Could not claim this reward. Try again." };
  }
  return { ok: true, code: data as string };
}

export interface LeaderRow {
  id: string;
  name: string;
  streak: number;
  isMe: boolean;
}

/** This month's top streaks among people who opted in. */
export async function loadLeaderboard(): Promise<{ rows: LeaderRow[]; optedIn: boolean } | null> {
  const caller = await getCaller();
  if (!caller) return null;
  const { admin, userId } = caller;
  const month = currentStreakMonth();
  const [{ data: rows }, { data: me }] = await Promise.all([
    admin
      .from("streaks")
      .select("user_id, current_count, profiles!inner(name, show_on_leaderboard, suspended)")
      .eq("month", month)
      .eq("profiles.show_on_leaderboard", true)
      .eq("profiles.suspended", false)
      .gt("current_count", 0)
      .order("current_count", { ascending: false })
      .limit(10),
    admin.from("profiles").select("show_on_leaderboard").eq("id", userId).single(),
  ]);
  return {
    optedIn: !!me?.show_on_leaderboard,
    rows: (rows ?? []).map((r) => {
      const p = r.profiles as unknown as { name: string };
      return { id: r.user_id, name: p.name.split(" ")[0], streak: r.current_count, isMe: r.user_id === userId };
    }),
  };
}

export async function setLeaderboardOptIn(on: boolean): Promise<{ ok: true } | Fail> {
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in first" };
  const { error } = await caller.supabase.from("profiles").update({ show_on_leaderboard: on }).eq("id", caller.userId);
  if (error) return { ok: false, error: error.message };
  if (on) await refreshStreak(caller.admin, caller.userId);
  return { ok: true };
}
