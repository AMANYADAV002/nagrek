import type { DigiLockerMode } from "@/lib/digilocker/contract";

/**
 * Provider selection. Production does not fall back to the simulator.
 * Setting DIGILOCKER_MODE does not register the app with DigiLocker.
 */
export function digilockerMode(): DigiLockerMode | "off" {
  const mode = process.env.DIGILOCKER_MODE?.trim();
  if (mode === "official") return "official";
  if (mode === "mock") return "mock";
  if (process.env.NODE_ENV === "production") return "off";
  return "mock";
}

export type OfficialSettings = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** The host named in Authorized Partner API Specification v2.0. */
export const OFFICIAL_ORIGIN = "https://digilocker.meripehchaan.gov.in";

export function officialSettings(): OfficialSettings | null {
  const clientId = process.env.DIGILOCKER_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI?.trim() ?? "";
  if (!clientId || !clientSecret || !redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !local) return null;
  } catch {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}
