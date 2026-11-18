import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** What may be stored after a provider says the person passed. No ID number and no image. */
export type VerificationToken = {
  provider: string;
  status: "verified" | "rejected";
  at: string;
};

export type SealedToken = {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

const TOKEN_KEYS = new Set(["provider", "status", "at"]);

export function keyFromSecret(secret: string): Buffer {
  const trimmed = secret.trim();
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length === 32 && decoded.toString("base64") === trimmed) return decoded;
  return createHash("sha256").update(trimmed, "utf8").digest();
}

/** Salted hash of the provider's reference. The reference itself is not stored. */
export function referenceHash(reference: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${reference}`, "utf8").digest("hex");
}

export function encryptToken(token: VerificationToken, key: Buffer, aad: string): SealedToken {
  assertToken(token);
  if (key.length !== 32) throw new Error("KYC key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ciphertext };
}

export function decryptToken(sealed: SealedToken, key: Buffer, aad: string): VerificationToken {
  if (key.length !== 32 || sealed.iv.length !== 12 || sealed.tag.length !== 16) throw new Error("KYC token is not valid");
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(sealed.tag);
  const json = Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
  const parsed: unknown = JSON.parse(json);
  assertToken(parsed);
  return parsed;
}

export function assertToken(value: unknown): asserts value is VerificationToken {
  if (!value || typeof value !== "object") throw new Error("KYC token is not valid");
  const keys = Object.keys(value);
  if (keys.some((key) => !TOKEN_KEYS.has(key))) throw new Error("KYC token is not valid");
  const token = value as VerificationToken;
  if (token.status !== "verified" && token.status !== "rejected") throw new Error("KYC token is not valid");
  if (!token.provider || token.provider.length > 40) throw new Error("KYC token is not valid");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(token.at)) throw new Error("KYC token is not valid");
}

export function signWebhook(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function webhookAuthentic(secret: string, timestamp: string, body: string, signature: string, now = Date.now()): boolean {
  if (!secret || !/^\d{10,13}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const raw = Number(timestamp);
  const ms = raw < 1e12 ? raw * 1000 : raw;
  if (Math.abs(now - ms) > 5 * 60_000) return false;
  const expected = Buffer.from(signWebhook(secret, timestamp, body), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
