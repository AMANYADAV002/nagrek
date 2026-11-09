import "server-only";
import { activePlan } from "@/lib/payments/plan-status";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/types";

export type Fail = { ok: false; error: string };

/** The signed-in caller plus a service-role client. Every service-role query must be scoped to `userId`. */
export async function getCaller() {
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  if (!supabase || !admin) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, admin, userId: data.user.id, email: data.user.email ?? "" };
}

export type Caller = NonNullable<Awaited<ReturnType<typeof getCaller>>>;

/** Caller who finished onboarding, is not suspended, and has an active plan. */
export async function getMember(): Promise<(Caller & { plan: PlanId }) | Fail> {
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in to continue" };
  const { data } = await caller.admin
    .from("profiles")
    .select("plan_id, plan_expires_at, onboarded_at, suspended")
    .eq("id", caller.userId)
    .single();
  if (!data?.onboarded_at) return { ok: false, error: "Finish onboarding first" };
  if (data.suspended) return { ok: false, error: "Your account is suspended. Contact support." };
  const plan = activePlan(data.plan_id, data.plan_expires_at);
  if (!plan) return { ok: false, error: "Choose a plan to continue" };
  return { ...caller, plan };
}

/** Midnight in India, as an ISO string. Daily limits reset at this time. */
export function startOfIndianDay(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3_600_000).toISOString();
}
