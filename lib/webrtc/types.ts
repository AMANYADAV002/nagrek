/**
 * Signalling contract. Designed for N participants so group rooms can be added later:
 * every message is addressed `from` → `to` (or broadcast). Carried over a private
 * Supabase Realtime channel, `room:{matchId}` or `call:{callId}` (see lib/webrtc/use-peer.ts).
 */
export type SignalMessage =
  | { type: "join"; from: string }
  | { type: "hello"; from: string; to: string }
  | { type: "leave"; from: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export interface IceConfig {
  iceServers: RTCIceServer[];
  /** Media only through TURN: neither side learns the other's IP address. */
  relayOnly: boolean;
}

export type PeerState = "waiting" | "connecting" | "connected" | "weak" | "reconnecting" | "failed" | "left";

/** Text sent on the call channel, event "chat". The WebRTC media stream is separate. */
export interface CallTextMessage {
  id: string;
  from: string;
  body: string;
  at: number;
  kind?: "text" | "emoji" | "gif" | "sticker";
}

/** Host and STUN candidates reveal a real IP address. Calls use the TURN relay only. */
export function stunServersFromEnv(): RTCIceServer[] {
  return [];
}
