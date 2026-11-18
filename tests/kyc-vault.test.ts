import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAdultDob, parseKycEvent, rejectedIdentityFields } from "@/lib/security/kyc";
import { callMayRelay } from "@/lib/security/turn-access";
import { decryptToken, encryptToken, keyFromSecret, referenceHash, signWebhook, webhookAuthentic } from "@/lib/security/vault-crypto";

const key = keyFromSecret("test-kyc-key");
const token = { provider: "sandbox", status: "verified" as const, at: "2026-11-15T12:00:00.000Z" };

describe("kyc vault", () => {
  it("seals a status token and rejects tampering or a swapped user", () => {
    const sealed = encryptToken(token, key, "user-a");
    expect(decryptToken(sealed, key, "user-a")).toEqual(token);
    expect(sealed.ciphertext.toString("utf8")).not.toContain("sandbox");
    expect(() => decryptToken(sealed, key, "user-b")).toThrow();
    const flipped = Buffer.from(sealed.ciphertext);
    flipped[0] ^= 1;
    expect(() => decryptToken({ ...sealed, ciphertext: flipped }, key, "user-a")).toThrow();
    const badTag = Buffer.from(sealed.tag);
    badTag[0] ^= 1;
    expect(() => decryptToken({ ...sealed, tag: badTag }, key, "user-a")).toThrow();
    expect(() => decryptToken({ ...sealed, iv: Buffer.alloc(12, 9) }, key, "user-a")).toThrow();
  });

  it("hashes the provider reference and refuses identity fields", () => {
    expect(referenceHash("ref-12345678", "salt")).toHaveLength(64);
    expect(referenceHash("ref-12345678", "salt")).not.toContain("ref-12345678");
    expect(referenceHash("ref-12345678", "salt")).toBe(referenceHash("ref-12345678", "salt"));
    expect(referenceHash("ref-12345678", "other")).not.toBe(referenceHash("ref-12345678", "salt"));
    expect(rejectedIdentityFields({ aadhaar: "xxxx" })).toBe(true);
    expect(parseKycEvent({ reference: "ref-12345678", user_id: "94ba99be-4331-4b6e-ac37-c7979d463c21", status: "verified", age_verified: true })).toMatchObject({ status: "verified" });
    expect(parseKycEvent({ reference: "ref-12345678", user_id: "94ba99be-4331-4b6e-ac37-c7979d463c21", status: "verified", age_verified: false })).toBeNull();
    expect(parseKycEvent({ reference: "ref-12345678", user_id: "94ba99be-4331-4b6e-ac37-c7979d463c21", status: "verified", age_verified: true, pan: "ABCDE1234F" })).toBeNull();
  });

  it("accepts a fresh webhook signature and rejects a stale or forged one", () => {
    const body = "{\"ok\":true}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWebhook("secret", timestamp, body);
    expect(webhookAuthentic("secret", timestamp, body, signature)).toBe(true);
    expect(webhookAuthentic("secret", timestamp, body, signature.replace("a", "b"))).toBe(false);
    expect(webhookAuthentic("secret", String(Math.floor(Date.now() / 1000) - 600), body, createHmac("sha256", "secret").update("x").digest("hex"))).toBe(false);
    expect(isAdultDob("2000-01-01", new Date("2026-11-15T00:00:00Z"))).toBe(true);
    expect(isAdultDob("2015-01-01", new Date("2026-11-15T00:00:00Z"))).toBe(false);
  });

  it("issues relay access only for an open call between two verified people", () => {
    const base = { userId: "a", callerId: "a", calleeId: "b", status: "accepted", matchLive: true, callerVerified: true, calleeVerified: true };
    expect(callMayRelay(base)).toBe(true);
    expect(callMayRelay({ ...base, userId: "c" })).toBe(false);
    expect(callMayRelay({ ...base, status: "ended" })).toBe(false);
    expect(callMayRelay({ ...base, matchLive: false })).toBe(false);
    expect(callMayRelay({ ...base, matchLive: false, connectionAccepted: true })).toBe(true);
    expect(callMayRelay({ ...base, calleeVerified: false })).toBe(false);
    expect(callMayRelay({ ...base, callerId: "a", calleeId: "a" })).toBe(false);
  });

  it("locks the kyc tables and does not add identity-number columns", () => {
    const sql = readFileSync("supabase/migrations/20261115183000_kyc_vault.sql", "utf8");
    for (const table of ["kyc_verifications", "kyc_audit_logs"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke all on public.${table} from public, anon, authenticated`);
    }
    expect(sql).toContain("kyc_audit_logs is append-only");
    expect(sql).toContain("before update or delete");
    expect(sql).not.toMatch(/aadhaar|pan_number|photo|image_path/i);
    expect(sql).toContain("security_invoker = true");
    expect(sql).toContain("revoke all on function public.kyc_read_token_key() from public, anon, authenticated");
  });
});
