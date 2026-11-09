import type { PlanId } from "@/lib/types";

/** A plan counts only until it expires. Every paid plan has an expiry (30 days per payment). */
export function activePlan(planId: string | null | undefined, expiresAt: string | null | undefined, now = new Date()): PlanId | null {
  if (!planId || !expiresAt) return null;
  return new Date(expiresAt) > now ? (planId as PlanId) : null;
}

export function daysLeft(expiresAt: string | null | undefined, now = new Date()): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}
