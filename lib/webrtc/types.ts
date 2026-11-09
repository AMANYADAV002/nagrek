/**
 * Signalling contract for Phase 5. Designed for N participants so group rooms
 * can be added later: every message is addressed `from` → `to` (or broadcast).
 *
 * TODO(phase-5): implement over a Supabase Realtime channel `room:{meetingId}`
 * (or a small WebSocket server) and build RTCPeerConnections with the
 * STUN/TURN servers from NEXT_PUBLIC_STUN_URLS / TURN_* env vars.
 */
export type SignalMessage =
  | { type: "join"; from: string }
  | { type: "leave"; from: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export interface SignalingChannel {
  send(message: SignalMessage): void;
  onMessage(handler: (message: SignalMessage) => void): () => void;
  close(): void;
}

export interface RoomParticipant {
  id: string;
  stream: MediaStream | null;
  connection: RTCPeerConnectionState | "mock";
}

export function iceServersFromEnv(): RTCIceServer[] {
  const stun = (process.env.NEXT_PUBLIC_STUN_URLS ?? "stun:stun.l.google.com:19302").split(",").filter(Boolean);
  const servers: RTCIceServer[] = [{ urls: stun }];
  // TURN credentials must be minted server-side (short-lived) — never ship static secrets to the client.
  return servers;
}
