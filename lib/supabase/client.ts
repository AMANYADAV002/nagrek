"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Returns null until env vars are configured, so the
 * demo still runs with no project. Auth and account actions use it when set.
 */
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
