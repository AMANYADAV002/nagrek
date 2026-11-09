import type { PlanId } from "@/lib/types";

/**
 * Route-guard rules, shared by the client <Guard> (Phase 1, mock session) and
 * proxy.ts (Phase 2, Supabase session — TODO(phase-2)).
 *
 *   auth      → must be signed in
 *   onboarded → signed in + finished onboarding (incl. 18+ consent)
 *   plan      → onboarded + active plan
 */
export type Requirement = "auth" | "onboarded" | "plan";

export interface SessionSnapshot {
  signedIn: boolean;
  onboarded: boolean;
  plan: PlanId | null;
}

export function redirectFor(req: Requirement, s: SessionSnapshot): string | null {
  if (!s.signedIn) return "/sign-in";
  if (req === "auth") return null;
  if (!s.onboarded) return "/onboarding";
  if (req === "onboarded") return null;
  if (!s.plan) return "/plans";
  return null;
}

/** Where a signed-in user should land after auth. */
export function homeFor(s: SessionSnapshot): string {
  if (!s.signedIn) return "/sign-in";
  if (!s.onboarded) return "/onboarding";
  if (!s.plan) return "/plans";
  return "/dashboard";
}
