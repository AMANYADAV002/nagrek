import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout handler signature: HMAC-SHA256 of `order_id|payment_id` with the key secret. */
export function isValidPaymentSignature(secret: string, orderId: string, paymentId: string, signature: string): boolean {
  return safeEqual(hmacHex(secret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
export function isValidWebhookSignature(secret: string, rawBody: string, signature: string): boolean {
  return safeEqual(hmacHex(secret, rawBody), signature);
}
