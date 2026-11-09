import { NextResponse } from "next/server";
import { isValidWebhookSignature } from "@/lib/payments/signature";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface PaymentEntity {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
}

interface WebhookEvent {
  event: string;
  payload: { payment?: { entity: PaymentEntity } };
}

/**
 * Razorpay webhook. Subscribe to `payment.captured`, `order.paid` and `payment.failed`.
 * Grants the plan or item even if the browser closed before confirmCheckout ran.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const admin = getSupabaseAdminClient();
  if (!secret || !admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!isValidWebhookSignature(secret, raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment = event.payload.payment?.entity;
  if (!payment?.order_id) return NextResponse.json({ ignored: true });

  if (event.event === "payment.captured" || event.event === "order.paid") {
    if (payment.currency !== "INR") return NextResponse.json({ error: "Unexpected currency" }, { status: 400 });
    const { data, error } = await admin.rpc("fulfill_payment", {
      p_order_id: payment.order_id,
      p_payment_id: payment.id,
      p_amount_paise: payment.amount,
    });
    if (error) {
      // Orders this app did not create are acknowledged so Razorpay stops retrying them.
      if (error.message.startsWith("Unknown order")) return NextResponse.json({ ignored: true });
      console.error("[razorpay] fulfill failed", payment.order_id, error.message);
      return NextResponse.json({ error: "Fulfilment failed" }, { status: 500 });
    }
    return NextResponse.json({ status: data });
  }

  if (event.event === "payment.failed") {
    await admin.from("payments").update({ status: "failed" }).eq("provider_ref", payment.order_id).eq("status", "created");
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ ignored: true });
}
