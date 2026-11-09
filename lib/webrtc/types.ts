/**
 * Signalling contract. Designed for N participants so group rooms can be added later:
 * every message is addressed `from` → `to` (or broadcast). Carried over the private
 * Supabase Realtime channel `room:{matchId}` (see lib/webrtc/use-peer.ts).
 */
export type SignalMessage =
  | { type: "join"; from: string }
  | { type: "hello"; from: string; to: string }
  | { type: "leave"; from: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export type PeerState = "waiting" | "connecting" | "connected" | "weak" | "reconnecting" | "failed" | "left";

export function stunServersFromEnv(): RTCIceServer[] {
  const stun = (process.env.NEXT_PUBLIC_STUN_URLS ?? "stun:stun.l.google.com:19302").split(",").map((s) => s.trim()).filter(Boolean);
  return [{ urls: stun }];
}
