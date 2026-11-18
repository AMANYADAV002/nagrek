import "server-only";
import { adultFromDigilocker } from "@/lib/kyc/age";
import { setuConfigured } from "@/lib/kyc/mode";

const SETU_HOSTS = new Set(["dg.setu.co", "dg-sandbox.setu.co"]);

export type SetuStart = { id: string; url: string };

export async function startSetuDigilocker(redirectUrl: string): Promise<SetuStart | null> {
  if (!setuConfigured()) return null;
  const response = await setuFetch("/api/digilocker/", {
    method: "POST",
    body: JSON.stringify({ redirectUrl }),
  });
  if (!response?.ok) return null;
  const json = (await response.json()) as { id?: unknown; url?: unknown };
  if (typeof json.id !== "string" || typeof json.url !== "string" || !allowedSetuUrl(json.url)) return null;
  return { id: json.id, url: json.url };
}

/**
 * Confirms the DigiLocker request and checks age from the identity payload.
 * The payload is not returned. Callers must not log the provider response.
 */
export async function confirmSetuDigilocker(requestId: string, today = new Date()): Promise<"adult" | "minor" | "unavailable"> {
  if (!setuConfigured() || !/^[0-9a-f-]{36}$/i.test(requestId)) return "unavailable";
  const statusResponse = await setuFetch(`/api/digilocker/${requestId}/status`);
  if (!statusResponse?.ok) return "unavailable";
  const statusJson = (await statusResponse.json()) as { status?: unknown };
  if (statusJson.status !== "authenticated") return "unavailable";

  const identity = await setuFetch(`/api/digilocker/${requestId}/aadhaar`);
  if (!identity?.ok) return "unavailable";
  const payload: unknown = await identity.json();
  const adult = adultFromDigilocker(payload, today);
  if (adult === null) return "unavailable";
  return adult ? "adult" : "minor";
}

function allowedSetuUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SETU_HOSTS.has(url.host);
  } catch {
    return false;
  }
}

function setuBase(): string | null {
  const override = process.env.SETU_BASE_URL?.replace(/\/$/, "");
  if (override) {
    try {
      const url = new URL(override);
      if (url.protocol === "https:" && SETU_HOSTS.has(url.host)) return url.origin;
    } catch {
      return null;
    }
    return null;
  }
  return process.env.SETU_ENV === "live" ? "https://dg.setu.co" : "https://dg-sandbox.setu.co";
}

async function setuFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const base = setuBase();
  const id = process.env.SETU_CLIENT_ID;
  const secret = process.env.SETU_CLIENT_SECRET;
  const product = process.env.SETU_PRODUCT_INSTANCE_ID;
  if (!base || !id || !secret || !product) return null;
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-client-id": id,
        "x-client-secret": secret,
        "x-product-instance-id": product,
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
