"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2).max(40),
  email: z.email(),
  password: z.string().min(8).max(72),
});

/**
 * Local preview only. Supabase's built-in mailer stops after a couple of emails an hour,
 * which blocks sign-up entirely. On localhost, create the account already confirmed so
 * the person can continue. Production keeps email confirmation.
 */
export async function createLocalAccount(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (!local) {
    return { ok: false, error: "The confirmation email could not be sent. Sign-up needs custom SMTP in Supabase before it works online." };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  if (rateLimited(`signup:${parsed.data.email.toLowerCase()}`, 5, 10 * 60_000)) return SLOW_DOWN;

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "The server is not configured for sign-up." };

  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { ok: false, error: "An account with this email already exists. Sign in instead." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
