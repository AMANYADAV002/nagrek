"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createOrder, mockPaymentsAllowed, razorpayConfigured } from "@/lib/payments/razorpay";
import { isValidPaymentSignature } from "@/lib/payments/signature";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/types";

const checkoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), planId: z.enum(["plus", "premium", "ultra"]) }),
  z.object({ kind: z.literal("avatar_item"), category: z.string().max(32), itemId: z.string().max(32) }),
]);

export type CheckoutRequest = z.infer<typeof checkoutSchema>;

export type CheckoutStart =
  | {
      ok: true;
      mode: "razorpay" | "mock";
      orderId: string;
      amountPaise: number;
      keyId: string | null;
      description: string;
      prefill: { name: string; email: string };
    }
  | { ok: false; error: string };

export type CheckoutConfirm =
  | { ok: true; plan: PlanId | null; planSince: string | null; planExpiresAt: string | null }
  | { ok: false; error: string };

const confirmSchema = z.object({
  orderId: z.string().min(1).max(64),
  paymentId: z.string().max(64),
  signature: z.string().max(128),
});

async function caller() {
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  if (!supabase || !admin) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { admin, user: data.user } : null;
}

/** Creates the order server-side. The price always comes from the database, never from the client. */
export async function startCheckout(raw: unknown): Promise<CheckoutStart> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid checkout request" };
  const ctx = await caller();
  if (!ctx) return { ok: false, error: "Sign in to continue" };
  const { admin, user } = ctx;

  const mode = razorpayConfigured() ? "razorpay" : mockPaymentsAllowed() ? "mock" : null;
  if (!mode) return { ok: false, error: "Payments are not set up yet. Please try again later." };

  const input = parsed.data;
  let amountInr: number;
  let description: string;
  let purpose: Record<string, string>;

  if (input.kind === "plan") {
    const { data: plan } = await admin.from("plans").select("id, name, price_inr").eq("id", input.planId).maybeSingle();
    if (!plan) return { ok: false, error: "Unknown plan" };
    amountInr = plan.price_inr;
    description = `${plan.name} plan · 30 days`;
    purpose = { purpose: "plan", plan_id: plan.id };
  } else {
    const { data: item } = await admin
      .from("avatar_items")
      .select("category, id, label, price_inr, unlock_type")
      .eq("category", input.category)
      .eq("id", input.itemId)
      .maybeSingle();
    if (!item || item.unlock_type || item.price_inr <= 0) return { ok: false, error: "This item is not for sale" };
    const { data: owned } = await admin
      .from("user_avatar_inventory")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("category", item.category)
      .eq("item_id", item.id)
      .maybeSingle();
    if (owned) return { ok: false, error: "You already own this item" };
    amountInr = item.price_inr;
    description = `Avatar item · ${item.label}`;
    purpose = { purpose: "avatar_item", item_category: item.category, item_id: item.id };
  }

  let orderId: string;
  if (mode === "razorpay") {
    try {
      const order = await createOrder({
        amountInr,
        receipt: `${user.id.slice(0, 8)}-${Date.now()}`,
        notes: { user_id: user.id, ...purpose },
      });
      orderId = order.id;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not start the payment" };
    }
  } else {
    orderId = `mock_order_${randomUUID()}`;
  }

  const { error } = await admin.from("payments").insert({
    user_id: user.id,
    // Mock and free-preview orders record ₹0 so they never count as revenue.
    amount_inr: mode === "mock" ? 0 : amountInr,
    status: "created",
    provider: mode,
    provider_ref: orderId,
    ...purpose,
  });
  if (error) return { ok: false, error: error.message };

  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
  return {
    ok: true,
    mode,
    orderId,
    amountPaise: amountInr * 100,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null,
    description,
    prefill: { name: profile?.name ?? "", email: user.email ?? "" },
  };
}

/** Verifies Razorpay's signature, then grants the plan or item. Safe to repeat; the webhook may get there first. */
export async function confirmCheckout(raw: unknown): Promise<CheckoutConfirm> {
  const parsed = confirmSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid payment confirmation" };
  const ctx = await caller();
  if (!ctx) return { ok: false, error: "Sign in to continue" };
  const { admin, user } = ctx;
  const { orderId, signature } = parsed.data;
  let { paymentId } = parsed.data;

  const { data: payment } = await admin.from("payments").select("user_id, provider").eq("provider_ref", orderId).maybeSingle();
  if (!payment || payment.user_id !== user.id) return { ok: false, error: "Payment not found" };

  if (payment.provider === "razorpay") {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || !isValidPaymentSignature(secret, orderId, paymentId, signature)) {
      return { ok: false, error: "We could not verify this payment. If money was deducted, it will be confirmed shortly." };
    }
  } else {
    if (!mockPaymentsAllowed()) return { ok: false, error: "Payment not found" };
    paymentId = `mock_pay_${randomUUID()}`;
  }

  const { error } = await admin.rpc("fulfill_payment", { p_order_id: orderId, p_payment_id: paymentId });
  if (error) return { ok: false, error: error.message };

  const { data: profile } = await admin.from("profiles").select("plan_id, plan_since, plan_expires_at").eq("id", user.id).single();
  return {
    ok: true,
    plan: (profile?.plan_id as PlanId | null) ?? null,
    planSince: profile?.plan_since ?? null,
    planExpiresAt: profile?.plan_expires_at ?? null,
  };
}

export async function markCheckoutFailed(orderId: string): Promise<void> {
  if (typeof orderId !== "string" || orderId.length > 64) return;
  const ctx = await caller();
  if (!ctx) return;
  await ctx.admin
    .from("payments")
    .update({ status: "failed" })
    .eq("provider_ref", orderId)
    .eq("user_id", ctx.user.id)
    .eq("status", "created");
}
