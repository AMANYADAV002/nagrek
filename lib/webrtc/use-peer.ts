"use client";

import { useEffect, useRef, useState } from "react";
import { getIceServers, markMeetingStarted } from "@/lib/actions/meeting";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PeerState, SignalMessage } from "@/lib/webrtc/types";

interface Options {
  matchId: string;
  me: string;
  partnerId: string;
  /** "a" (who started the match) makes offers; "b" answers. Avoids offer collisions. */
  role: "a" | "b";
  /** Null when the camera is blocked: the call still connects, receive-only. */
  localStream: MediaStream | null;
  /** Start once the camera attempt has finished. */
  enabled: boolean;
}

/**
 * One-to-one WebRTC call. Signalling runs on the private Realtime channel `room:<matchId>`,
 * which only the two participants of a live match can use (RLS on realtime.messages).
 * Media goes browser-to-browser (or via TURN). Nothing is recorded.
 */
export function usePeer({ matchId, me, partnerId, role, localStream, enabled }: Options) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<PeerState>("waiting");
  const leaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!enabled || !supabase) return;
    let closed = false;
    let started = false;
    const queued: RTCIceCandidateInit[] = [];
    let pc: RTCPeerConnection | null = null;
    let stats: ReturnType<typeof setInterval> | null = null;

    const channel = supabase.channel(`room:${matchId}`, { config: { private: true, broadcast: { self: false } } });
    const send = (message: SignalMessage) => void channel.send({ type: "broadcast", event: "signal", payload: message });

    const flush = async () => {
      while (pc?.remoteDescription && queued.length) await pc.addIceCandidate(queued.shift()).catch(() => {});
    };

    const offer = async (iceRestart = false) => {
      if (!pc || pc.signalingState !== "stable") return;
      if (!iceRestart && pc.connectionState === "connected") return;
      setState((s) => (s === "connected" ? s : "connecting"));
      const sdp = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription(sdp);
      send({ type: "offer", from: me, to: partnerId, sdp });
    };

    const handle = async (msg: SignalMessage) => {
      if (closed || !pc || msg.from !== partnerId) return;
      if ("to" in msg && msg.to !== me) return;
      switch (msg.type) {
        case "join":
          if (role === "a") await offer();
          else send({ type: "hello", from: me, to: partnerId });
          break;
        case "hello":
          if (role === "a") await offer();
          break;
        case "offer":
          if (role !== "b") return;
          setState((s) => (s === "connected" ? s : "connecting"));
          await pc.setRemoteDescription(msg.sdp);
          await flush();
          await pc.setLocalDescription(await pc.createAnswer());
          send({ type: "answer", from: me, to: partnerId, sdp: pc.localDescription!.toJSON() });
          break;
        case "answer":
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(msg.sdp);
            await flush();
          }
          break;
        case "ice":
          if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate).catch(() => {});
          else queued.push(msg.candidate);
          break;
        case "leave":
          setState("left");
          break;
      }
    };

    (async () => {
      const iceServers = await getIceServers(matchId);
      if (closed) return;
      pc = new RTCPeerConnection({ iceServers });

      if (localStream) localStream.getTracks().forEach((t) => pc!.addTrack(t, localStream));
      else if (role === "a") {
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });
      }

      pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
      pc.onicecandidate = (e) => e.candidate && send({ type: "ice", from: me, to: partnerId, candidate: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        const s = pc?.connectionState;
        if (s === "connected") {
          setState("connected");
          if (!started) {
            started = true;
            void markMeetingStarted(matchId);
          }
        } else if (s === "disconnected") setState("reconnecting");
        else if (s === "failed") {
          setState("reconnecting");
          if (role === "a") void offer(true);
        }
      };

      // Weak-network hint from round-trip time and packet loss on the active candidate pair.
      stats = setInterval(async () => {
        if (!pc || pc.connectionState !== "connected") return;
        const report = await pc.getStats();
        let rtt = 0;
        let lost = 0;
        let received = 0;
        report.forEach((r) => {
          if (r.type === "candidate-pair" && r.state === "succeeded" && r.nominated) rtt = r.currentRoundTripTime ?? 0;
          if (r.type === "inbound-rtp") {
            lost += r.packetsLost ?? 0;
            received += r.packetsReceived ?? 0;
          }
        });
        const lossRate = received ? lost / (lost + received) : 0;
        setState((s) => (s === "connected" || s === "weak" ? (rtt > 0.4 || lossRate > 0.05 ? "weak" : "connected") : s));
      }, 4000);

      await supabase.realtime.setAuth();
      channel
        .on("broadcast", { event: "signal" }, ({ payload }) => void handle(payload as SignalMessage))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") send({ type: "join", from: me });
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setState("failed");
        });
    })();

    // "leave" only on a deliberate hang-up or tab close, never on effect cleanup:
    // React remounts in development and that would end the partner's call.
    const leave = () => send({ type: "leave", from: me });
    leaveRef.current = leave;
    window.addEventListener("pagehide", leave);

    return () => {
      closed = true;
      if (stats) clearInterval(stats);
      window.removeEventListener("pagehide", leave);
      pc?.close();
      void supabase.removeChannel(channel);
    };
  }, [enabled, matchId, me, partnerId, role, localStream]);

  return { remoteStream, state, leave: () => leaveRef.current() };
}
