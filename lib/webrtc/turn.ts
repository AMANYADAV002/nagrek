import "server-only";
import { createHmac } from "node:crypto";
import type { IceConfig } from "@/lib/webrtc/types";

const CREDENTIAL_TTL_SECONDS = 2 * 60 * 60;

/**
 * ICE servers for one participant. With TURN_SECRET set, credentials follow coturn's
 * `use-auth-secret` scheme: username `<expiry>:<user id>`, password HMAC-SHA1(secret, username),
 * so they expire on their own and the shared secret never leaves the server.
 * The result is always relay-only. Public STUN servers are not included.
 */
export function iceConfigFor(userId: string, now = Date.now(), ttlSeconds = CREDENTIAL_TTL_SECONDS): IceConfig {
  const blocked = { iceServers: [], relayOnly: true as const };
  const urls = process.env.TURN_URLS?.split(",").map((s) => s.trim()).filter((url) => url.startsWith("turn:") || url.startsWith("turns:"));
  const secret = process.env.TURN_SECRET;
  if (!urls?.length || !secret) return blocked;
  const username = `${Math.floor(now / 1000) + ttlSeconds}:${userId}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");
  return { iceServers: [{ urls, username, credential }], relayOnly: true };
}
