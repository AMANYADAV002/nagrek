import type { SupabaseClient } from "@supabase/supabase-js";
import { TERMS_VERSION } from "@/lib/data/legal";
import { preferencesRow, publicProfilePatch } from "@/lib/db/map";
import { onboardingSchema } from "@/lib/validation/onboarding";

type Result = { ok: true } | { ok: false; error: string };

/** Writes onboarding with the signed-in client, so the browser session is enough. RLS keeps it to that user. */
export async function saveAccount(supabase: SupabaseClient, userId: string, raw: unknown): Promise<Result> {
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answers" };

  const pref = await supabase.from("user_preferences").upsert(preferencesRow(userId, parsed.data));
  if (pref.error) return { ok: false, error: pref.error.message };

  const consent = await supabase.from("consents").upsert(
    { user_id: userId, adult: true, respectful: true, terms_version: TERMS_VERSION },
    { onConflict: "user_id,terms_version", ignoreDuplicates: true },
  );
  if (consent.error) return { ok: false, error: consent.error.message };

  const profile = await supabase.from("profiles").update(publicProfilePatch(parsed.data)).eq("id", userId);
  if (profile.error) return { ok: false, error: profile.error.message };

  const done = await supabase.rpc("complete_onboarding");
  if (done.error) return { ok: false, error: done.error.message };
  return { ok: true };
}
