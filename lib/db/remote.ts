"use client";

import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";
import { resetSession } from "@/lib/mock/session";

type Result = { ok: boolean; error?: string };

/** Runs a server action only when Supabase is configured. Failures surface as a toast. */
export function syncBackend(run: () => Promise<Result>) {
  if (!backendEnabled()) return;
  void run().then((result) => {
    if (!result.ok) toast.error(result.error ?? "Could not save that");
  });
}

export async function signOutEverywhere() {
  if (backendEnabled()) await getSupabaseBrowserClient()?.auth.signOut();
  resetSession();
  // Full reload so the route guard doesn't race a client-side navigation.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/";
}
