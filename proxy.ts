import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { redirectFor, type Requirement } from "@/lib/guards";
import type { PlanId } from "@/lib/types";

/**
 * Next.js 16 proxy (formerly middleware).
 * Without Supabase env vars this passes through and the client <Guard> applies.
 * With env vars it refreshes the auth cookie and enforces the same redirectFor() rules.
 */
const RULES: { prefix: string; need: Requirement }[] = [
  { prefix: "/onboarding", need: "auth" },
  { prefix: "/welcome", need: "onboarded" },
  { prefix: "/plans", need: "onboarded" },
  { prefix: "/admin", need: "auth" },
  { prefix: "/dashboard", need: "plan" },
  { prefix: "/profile", need: "plan" },
  { prefix: "/stories", need: "plan" },
  { prefix: "/streak", need: "plan" },
  { prefix: "/wishlist", need: "plan" },
  { prefix: "/connections", need: "plan" },
  { prefix: "/explore", need: "plan" },
  { prefix: "/avatar", need: "plan" },
  { prefix: "/match", need: "plan" },
  { prefix: "/room", need: "plan" },
  { prefix: "/feedback", need: "plan" },
];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: auth } = await supabase.auth.getUser();
  const rule = RULES.find((r) => request.nextUrl.pathname === r.prefix || request.nextUrl.pathname.startsWith(`${r.prefix}/`));
  if (!rule) return response;

  let onboarded = false;
  let plan: PlanId | null = null;
  if (auth.user) {
    const { data, error } = await supabase.from("profiles").select("onboarded_at, plan_id").eq("id", auth.user.id).maybeSingle();
    // Missing tables (migration not run) should not lock every route.
    if (error) return response;
    onboarded = !!data?.onboarded_at;
    plan = (data?.plan_id as PlanId | null) ?? null;
  }

  const dest = redirectFor(rule.need, { signedIn: !!auth.user, onboarded, plan });
  if (!dest || dest === request.nextUrl.pathname) return response;

  const redirect = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/welcome/:path*",
    "/plans/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/stories/:path*",
    "/streak/:path*",
    "/wishlist/:path*",
    "/connections/:path*",
    "/explore/:path*",
    "/avatar/:path*",
    "/match/:path*",
    "/room/:path*",
    "/feedback/:path*",
    "/admin/:path*",
  ],
};
