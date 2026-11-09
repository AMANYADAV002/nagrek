import { NextResponse } from "next/server";
import { razorpayConfigured } from "@/lib/payments/razorpay";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Uptime check for Hostinger or any monitor. Reports what is configured, never the values. */
export async function GET() {
  const started = Date.now();
  const admin = getSupabaseAdminClient();
  let database: "ok" | "error" | "not_configured" = "not_configured";
  if (admin) {
    const { error } = await admin.from("plans").select("id", { head: true, count: "exact" });
    database = error ? "error" : "ok";
  }
  const body = {
    status: database === "error" ? "degraded" : "ok",
    database,
    payments: razorpayConfigured() ? "razorpay" : process.env.NEXT_PUBLIC_FREE_PREVIEW === "true" ? "free_preview" : "off",
    turn: Boolean(process.env.TURN_URLS),
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs: Date.now() - started,
  };
  return NextResponse.json(body, { status: database === "error" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
