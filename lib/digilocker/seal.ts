import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { keyFromSecret } from "@/lib/security/vault-crypto";

export function digilockerKey(): Buffer | null {
  const secret = process.env.DIGILOCKER_SESSION_KEY?.trim();
  if (secret) return keyFromSecret(secret);
  if (process.env.NODE_ENV !== "production") return keyFromSecret("nagrek-digilocker-dev-session");
  return null;
}

export function sealJson(value: unknown, key: Buffer): string {
  if (key.length !== 32) throw new Error("DigiLocker session key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function openJson<T>(sealed: string, key: Buffer): T | null {
  const parts = sealed.split(".");
  if (parts.length !== 3 || key.length !== 32) return null;
  try {
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
