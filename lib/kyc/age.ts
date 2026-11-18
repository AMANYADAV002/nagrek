import { isAdultDob } from "@/lib/security/kyc";

const SETU_HOSTS = new Set(["dg.setu.co", "dg-sandbox.setu.co"]);

/** Drops date fields before a provider event is parsed. Other identity keys stay, and the parser rejects them. */
export function stripDateFields(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripDateFields);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "dob" || key === "dateOfBirth" || key === "date_of_birth") continue;
    out[key] = stripDateFields(child);
  }
  return out;
}

/** Reads a date of birth and nothing else. Missing or unreadable dates fail closed. */
export function adultFromDigilocker(payload: unknown, today = new Date()): boolean | null {
  const iso = isoDateOfBirth(payload);
  if (!iso) return null;
  return isAdultDob(iso, today);
}

export function setuRedirectAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SETU_HOSTS.has(url.host);
  } catch {
    return false;
  }
}

function isoDateOfBirth(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const nested = root.aadhaar;
  const source = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : root;
  const raw = source.dateOfBirth ?? source.date_of_birth ?? source.dob;
  if (typeof raw !== "string") return null;
  const dayFirst = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}
