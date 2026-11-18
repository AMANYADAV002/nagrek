import { z } from "zod";

const BANNED_KEY = /aadhaar|pan|photo|image|document|dob|birth|address|email|phone|name/i;

/** Provider events may only carry a reference and a result. Identity fields are rejected. */
export const kycEventSchema = z
  .object({
    reference: z.string().trim().min(8).max(120),
    user_id: z.uuid(),
    status: z.enum(["verified", "rejected"]),
    age_verified: z.boolean(),
    provider: z.string().trim().min(2).max(40).default("sandbox"),
  })
  .strict();

export type KycEvent = z.infer<typeof kycEventSchema>;

export function rejectedIdentityFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (BANNED_KEY.test(key)) return true;
    if (child && typeof child === "object" && rejectedIdentityFields(child)) return true;
  }
  return false;
}

export function parseKycEvent(value: unknown): KycEvent | null {
  if (rejectedIdentityFields(value)) return null;
  const parsed = kycEventSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.status === "verified" && !parsed.data.age_verified) return null;
  return parsed.data;
}

/** True when the calendar date is at least 18 years before `today`. */
export function isAdultDob(isoDate: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const dob = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return false;
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
  return dob.getTime() <= cutoff.getTime();
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Platform-set addresses only. A client-supplied forwarding list is ignored. */
export function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim() ?? request.headers.get("cf-connecting-ip")?.trim();
  if (!real || real.length > 64 || /[\s,]/.test(real)) return null;
  return real;
}

export async function readBody(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) return null;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
