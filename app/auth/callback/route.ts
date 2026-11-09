import { NextResponse } from "next/server";
import { homeFor } from "@/lib/guards";
import { activePlan } from "@/lib/payments/plan-status";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** OAuth and magic-link landing. Exchanges the code, then sends the user where their account should be. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await getSupabaseServerClient();

  if (!code || !supabase) return NextResponse.redirect(new URL("/sign-in", url.origin));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/sign-in", url.origin));

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, plan_id, plan_expires_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  const dest = homeFor({
    signedIn: true,
    onboarded: !!profile?.onboarded_at,
    plan: activePlan(profile?.plan_id, profile?.plan_expires_at),
  });
  return NextResponse.redirect(new URL(dest, url.origin));
}
