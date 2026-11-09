import "server-only";
import { freePreview } from "@/lib/payments/mode";

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** ₹0 checkout: local development without keys, or an explicit free preview. Never alongside Razorpay. */
export function mockPaymentsAllowed(): boolean {
  return !razorpayConfigured() && (process.env.NODE_ENV === "development" || freePreview());
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export async function createOrder(input: { amountInr: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: input.amountInr * 100,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { description?: string } } | null;
    throw new Error(body?.error?.description ?? `Razorpay order failed (${res.status})`);
  }
  return (await res.json()) as RazorpayOrder;
}
