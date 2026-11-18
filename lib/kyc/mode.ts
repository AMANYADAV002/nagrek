/** Local simulator. Production ignores this flag. */
export function sandboxEnabled(): boolean {
  return process.env.KYC_SANDBOX_MODE === "true" || process.env.KYC_SANDBOX === "true";
}

export function sandboxRouteAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && sandboxEnabled();
}

export function setuConfigured(): boolean {
  return Boolean(process.env.SETU_CLIENT_ID && process.env.SETU_CLIENT_SECRET && process.env.SETU_PRODUCT_INSTANCE_ID);
}

/** Matching stays open until a provider or the local simulator is switched on. */
export function kycEnforced(): boolean {
  return sandboxEnabled() || setuConfigured();
}
