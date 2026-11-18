import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createPkce(bytes = randomBytes(32)): { verifier: string; challenge: string } {
  const verifier = bytes.toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createState(bytes = randomBytes(16)): string {
  return bytes.toString("hex");
}

export function statesMatch(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length < 16 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
