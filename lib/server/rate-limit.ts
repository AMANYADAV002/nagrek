import "server-only";

/**
 * Burst limiter kept in process memory. Fine for a single Node process (Hostinger); daily
 * limits that must survive restarts live in the database. Use a shared store if you scale out.
 */
const hits = new Map<string, number[]>();
let lastSweep = Date.now();

export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, times] of hits) if (!times.some((t) => now - t < 10 * 60_000)) hits.delete(k);
    lastSweep = now;
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export const SLOW_DOWN = { ok: false as const, error: "You're going a bit fast. Wait a moment and try again." };
