/**
 * Payment gateway bypass for non-payment workstreams.
 * When Razorpay is not configured, or NAGREK_SKIP_PAYWALL=1, the app
 * skips the paywall stage and the socket server skips PAYMENT_REQUIRED.
 */

export function isPaywallBypassedClient(): boolean {
  if (typeof process === 'undefined') return true
  if (process.env.NEXT_PUBLIC_NAGREK_SKIP_PAYWALL === '1') return true
  if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) return true
  return false
}

/** Server-side check (Node / API routes / server.js). */
export function isPaywallBypassedServer(): boolean {
  if (process.env.NAGREK_SKIP_PAYWALL === '1') return true
  if (!process.env.RAZORPAY_KEY_ID && !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) return true
  return false
}
