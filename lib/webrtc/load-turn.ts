"use client";

import type { IceConfig } from "@/lib/webrtc/types";

const EMPTY: IceConfig = { iceServers: [], relayOnly: true };

function relayServers(servers: RTCIceServer[] | undefined): RTCIceServer[] {
  return (servers ?? []).filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.every((url) => url.startsWith("turn:") || url.startsWith("turns:")) && urls.length > 0;
  });
}

/** Voice and video calls load short-lived TURN credentials from the relay route. */
export async function loadTurnCredentials(body: { callId: string } | { matchId: string }): Promise<IceConfig> {
  try {
    const res = await fetch("/api/turn-credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return EMPTY;
    const json = (await res.json()) as Partial<IceConfig>;
    const iceServers = relayServers(json.iceServers);
    if (iceServers.length === 0) return EMPTY;
    return { iceServers, relayOnly: true };
  } catch {
    return EMPTY;
  }
}
