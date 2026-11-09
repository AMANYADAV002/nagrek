import { STREAK_MILESTONES } from "@/lib/config/streak";
import type { PlanId } from "@/lib/types";
import type { Reward } from "@/lib/mock/rewards";

/**
 * STREAK RULE
 * - A calendar day "counts" when the user completes at least one meeting
 *   (`meeting_completed`) or accepts a join request that leads to a meeting
 *   (`join_accepted`). Other events never count.
 * - The streak is the run of consecutive counting days that ends today, or
 *   yesterday (so it does not look broken before today is over).
 * - Only days in the current calendar month count: the streak resets monthly.
 */
export type StreakEventType = "meeting_completed" | "join_accepted" | "app_open";

export interface StreakEvent {
  type: StreakEventType;
  at: string | Date;
}

const COUNTING: StreakEventType[] = ["meeting_completed", "join_accepted"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function calculateStreak(events: StreakEvent[], now: Date = new Date()): number {
  const days = new Set(
    events
      .filter((e) => COUNTING.includes(e.type))
      .map((e) => new Date(e.at))
      .filter((d) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d <= now)
      .map(dayKey),
  );

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (cursor.getMonth() === now.getMonth() && days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function milestoneProgress(streak: number, milestones: readonly number[] = STREAK_MILESTONES) {
  const next = milestones.find((m) => m > streak) ?? null;
  const prev = [...milestones].reverse().find((m) => m <= streak) ?? 0;
  const progress = next === null ? 1 : (streak - prev) / (next - prev);
  return { prev, next, progress };
}

const PLAN_RANK: Record<PlanId, number> = { plus: 1, premium: 2, ultra: 3 };

export type IneligibleReason = "claimed" | "visits" | "plan" | "expired" | "out_of_stock";

/** Mirrors claim_reward() in the database. `visits` is the verified-visit streak. */
export function rewardEligibility(
  reward: Pick<Reward, "id" | "minVisits" | "minPlan" | "expiresAt" | "stock">,
  ctx: { visits: number; plan: PlanId | null; claimedIds: string[]; now?: Date },
): { eligible: boolean; reason?: IneligibleReason } {
  const now = ctx.now ?? new Date();
  if (ctx.claimedIds.includes(reward.id)) return { eligible: false, reason: "claimed" };
  if (new Date(reward.expiresAt) < now) return { eligible: false, reason: "expired" };
  if (reward.stock <= 0) return { eligible: false, reason: "out_of_stock" };
  if (!ctx.plan || PLAN_RANK[ctx.plan] < PLAN_RANK[reward.minPlan]) return { eligible: false, reason: "plan" };
  if (ctx.visits < reward.minVisits) return { eligible: false, reason: "visits" };
  return { eligible: true };
}
