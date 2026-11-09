/**
 * Free preview: no Razorpay keys and NEXT_PUBLIC_FREE_PREVIEW=true. Plans and avatar items
 * activate instantly at ₹0 through the same server path. Adding Razorpay keys turns it off.
 * Safe on the client: both values are public.
 */
export function freePreview(): boolean {
  return !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.NEXT_PUBLIC_FREE_PREVIEW === "true";
}
