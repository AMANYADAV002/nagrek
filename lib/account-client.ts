import { loadAccount, type AccountResult } from "@/lib/account-load";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type { AccountResult };

/** Reads the account with the browser session, which is the session sign-in just created. */
export async function fetchMyAccount(): Promise<AccountResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { account: null };
  try {
    return await loadAccount(supabase);
  } catch {
    return { account: null, error: "Could not load your account" };
  }
}
