import "server-only";
import { createHmac } from "node:crypto";
import { stunServersFromEnv, type IceConfig } from "@/lib/webrtc/types";

const CREDENTIAL_TTL_SECONDS = 2 * 60 * 60;

/**
 * ICE servers for one participant. With TURN_SECRET set, credentials follow coturn's
 * `use-auth-secret` scheme: username `<expiry>:<user id>`, password HMAC-SHA1(secret, username),
 * so they expire on their own and the shared secret never leaves the server.
 * TURN_FORCE_RELAY=true sends all media through the relay, which hides each person's IP address.
 */
export function iceConfigFor(userId: string, now = Date.now()): IceConfig {
  const iceServers = stunServersFromEnv();
  const urls = process.env.TURN_URLS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (!urls?.length) return { iceServers, relayOnly: false };

  const secret = process.env.TURN_SECRET;
  if (secret) {
    const username = `${Math.floor(now / 1000) + CREDENTIAL_TTL_SECONDS}:${userId}`;
    const credential = createHmac("sha1", secret).update(username).digest("base64");
    iceServers.push({ urls, username, credential });
  } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  } else {
    return { iceServers, relayOnly: false };
  }
  return { iceServers, relayOnly: process.env.TURN_FORCE_RELAY === "true" };
}
