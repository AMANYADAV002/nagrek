import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 "proxy" (formerly middleware).
 *
 * Phase 1: the session is mocked in localStorage, which the server cannot
 * read, so route guards run client-side in <Guard> (components/guard.tsx)
 * using the shared rules in lib/guards.ts. This proxy only passes through.
 *
 * TODO(phase-2): create a Supabase server client here, refresh the auth
 * cookie, load the user's onboarding + subscription state, and apply
 * `redirectFor()` from lib/guards.ts before the page renders.
 */
export function proxy(request: NextRequest) {
  void request;
  return NextResponse.next();
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
