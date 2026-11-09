import { NextResponse } from "next/server";
import { homeFor } from "@/lib/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/types";

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

  const { data: profile } = await supabase.from("profiles").select("onboarded_at, plan_id").eq("id", auth.user.id).maybeSingle();
  const dest = homeFor({
    signedIn: true,
    onboarded: !!profile?.onboarded_at,
    plan: (profile?.plan_id as PlanId | null) ?? null,
  });
  return NextResponse.redirect(new URL(dest, url.origin));
}
