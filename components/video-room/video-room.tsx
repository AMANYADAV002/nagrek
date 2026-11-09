"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera, CameraOff, Flag, Lightbulb, Mic, MicOff, Music2, PhoneOff, RefreshCw, Shuffle, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { MusicPanel } from "@/components/music-player/music-panel";
import { ReportDialog } from "@/components/safety/report-dialog";
import { getPlan } from "@/lib/config/plans";
import { cravingEmoji } from "@/lib/data/cravings";
import { icebreakers } from "@/lib/data/icebreakers";
import { track } from "@/lib/analytics";
import { toneLabel } from "@/lib/format";
import { endMeeting, getIceServers, markMeetingStarted } from "@/lib/actions/meeting";
import { updateSession, useSession } from "@/lib/mock/session";
import type { MockUser } from "@/lib/types";
import { usePeer } from "@/lib/webrtc/use-peer";
import type { PeerState } from "@/lib/webrtc/types";
import { cn } from "@/lib/utils";

type CamState = "requesting" | "on" | "denied" | "unavailable";
type Net = "good" | "weak" | "reconnecting";

const netFromPeer: Record<PeerState, Net> = {
  waiting: "good",
  connecting: "good",
  connected: "good",
  weak: "weak",
  reconnecting: "reconnecting",
  failed: "reconnecting",
  left: "good",
};

/**
 * Live: a real one-to-one WebRTC call with the matched person (lib/webrtc/use-peer.ts).
 * Demo: real local camera preview and a simulated partner. Calls are never recorded.
 */
export function VideoRoom({
  meetingId,
  partner,
  food,
  live,
}: {
  meetingId: string;
  partner: MockUser;
  food: string;
  live?: { me: string; role: "a" | "b" };
}) {
  const router = useRouter();
  const session = useSession();
  const plan = getPlan(session?.plan);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const ending = useRef(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cam, setCam] = useState<CamState>("requesting");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [musicOpen, setMusicOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [prompt, setPrompt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [net, setNet] = useState<Net>("good");
  const [speaking, setSpeaking] = useState(false);

  const startCamera = useCallback(async () => {
    setCam("requesting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("unavailable");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      stream.current?.getTracks().forEach((tr) => tr.stop());
      stream.current = s;
      if (localVideo.current) localVideo.current.srcObject = s;
      setLocalStream(s);
      setCam("on");
    } catch (e) {
      setCam((e as DOMException)?.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(startCamera, 0);
    return () => {
      clearTimeout(t);
      stream.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [startCamera]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const peer = usePeer({
    topic: `room:${meetingId}`,
    me: live?.me ?? "",
    partnerId: partner.id,
    role: live?.role ?? "a",
    localStream,
    enabled: !!live && cam !== "requesting",
    loadIce: () => getIceServers(meetingId),
    onConnected: () => void markMeetingStarted(meetingId),
  });

  useEffect(() => {
    if (remoteVideo.current && peer.remoteStream) remoteVideo.current.srcObject = peer.remoteStream;
  }, [peer.remoteStream]);

  // Demo only: a simulated partner "speaking" and a network wobble to exercise the warning UI.
  useEffect(() => {
    if (live) return;
    const talk = setInterval(() => setSpeaking((s) => !s), 2600);
    const wobble = setTimeout(() => {
      setNet("weak");
      setTimeout(() => setNet("reconnecting"), 2500);
      setTimeout(() => setNet("good"), 5000);
    }, 25000);
    return () => {
      clearInterval(talk);
      clearTimeout(wobble);
    };
  }, [live]);

  useEffect(() => {
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);
  useEffect(() => {
    stream.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);

  const endCall = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    peer.leave();
    stream.current?.getTracks().forEach((t) => t.stop());
    track("meeting_complete", { meetingId, seconds: elapsed });
    if (live) {
      const res = await endMeeting(meetingId);
      if (res.ok) updateSession({ streakEvents: res.streakEvents });
      router.push(`/feedback/${meetingId}`);
      return;
    }
    // Streak rule: a completed meeting counts for today (see lib/streak/calc.ts).
    updateSession((s) => ({ streakEvents: [...s.streakEvents, { type: "meeting_completed", at: new Date().toISOString() }] }));
    router.push(`/feedback/${meetingId}?with=${partner.id}&food=${encodeURIComponent(food)}`);
  }, [peer, meetingId, elapsed, live, router, partner.id, food]);

  useEffect(() => {
    if (peer.state !== "left" || ending.current) return;
    toast.message(`${partner.name.split(" ")[0]} left the table.`);
    void endCall();
  }, [peer.state, partner.name, endCall]);

  const shownNet: Net = live ? netFromPeer[peer.state] : net;
  const remoteLabel = !live
    ? `${partner.area} · demo participant`
    : peer.state === "waiting"
      ? `Waiting for ${partner.name.split(" ")[0]} to join…`
      : peer.state === "connecting"
        ? "Connecting…"
        : peer.state === "failed"
          ? "Couldn't connect. Check your network or try again."
          : partner.area;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden /> Live · {mm}:{ss}
          </span>
          <span className="glass rounded-full px-3 py-1.5">{cravingEmoji[food] ?? "🍽️"} {food}</span>
          <span className="glass rounded-full px-3 py-1.5">{toneLabel(partner.tone)}</span>
        </div>
        <span
          className={cn(
            "glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs",
            shownNet === "weak" && "text-amber-300",
            shownNet === "reconnecting" && "text-red-300",
          )}
          role="status"
        >
          {shownNet === "reconnecting" ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
          {shownNet === "good" ? "Good connection" : shownNet === "weak" ? "Weak network" : "Reconnecting…"}
        </span>
      </div>

      {/* remote tile: live video when connected, otherwise the partner's avatar */}
      <div className="relative flex-1 overflow-hidden">
        {live && (
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className={cn("absolute inset-0 z-[1] size-full object-cover", !peer.remoteStream && "hidden")}
          />
        )}
        <motion.div
          className="absolute inset-0"
          animate={{ scale: speaking ? 1.02 : 1 }}
          transition={{ duration: 1.2 }}
        >
          <div className="absolute inset-0 scale-150 opacity-60 blur-3xl" aria-hidden>
            <LayeredAvatar config={partner.avatar} />
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <div className={cn("size-56 rounded-full transition-shadow duration-700 md:size-80", speaking && "shadow-[0_0_0_6px_rgb(74_222_128/0.5)]")}>
              <LayeredAvatar config={partner.avatar} title={partner.name} />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        </motion.div>
        <div className="absolute bottom-28 left-4 z-10 md:bottom-32">
          <p className="flex items-center gap-2 font-heading text-2xl">
            {partner.name}
            {speaking && <span className="size-2 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]" aria-label="speaking" />}
          </p>
          <p className="text-xs text-white/70">{remoteLabel}</p>
        </div>

        {/* local preview */}
        <div className="absolute top-20 right-4 z-10 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-white/20 bg-ink-2 shadow-2xl md:w-44">
          <video ref={localVideo} autoPlay playsInline muted className={cn("size-full -scale-x-100 object-cover", (!camOn || cam !== "on") && "hidden")} />
          {cam !== "on" || !camOn ? (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-2 text-center text-[10px] text-white/70">
              {cam === "requesting" && "Starting camera…"}
              {cam === "denied" && (
                <>
                  <CameraOff className="size-5 text-peach" />
                  Camera blocked. Allow it in browser settings.
                  <button type="button" onClick={startCamera} className="flex items-center gap-1 text-peach underline">
                    <RefreshCw className="size-3" /> Retry
                  </button>
                </>
              )}
              {cam === "unavailable" && (
                <>
                  <CameraOff className="size-5 text-peach" /> No camera found
                </>
              )}
              {cam === "on" && !camOn && (
                <>
                  <CameraOff className="size-5" /> Camera off
                </>
              )}
            </div>
          ) : null}
          <span className="absolute bottom-1.5 left-2 text-[10px] font-semibold">You</span>
        </div>

        {/* icebreaker */}
        <div className="absolute top-20 left-4 z-10 max-w-[calc(100%-10rem)] md:max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={prompt}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="glass-strong flex items-start gap-3 rounded-2xl p-3.5"
            >
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-peach" aria-hidden />
              <p className="text-sm">{icebreakers[prompt % icebreakers.length]}</p>
              <button
                type="button"
                onClick={() => setPrompt((p) => p + 1 + Math.floor(Math.random() * 3))}
                aria-label="New icebreaker"
                className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-white/10"
              >
                <Shuffle className="size-3.5" />
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* music panel */}
      <AnimatePresence>
        {musicOpen && (
          <div className="absolute right-4 bottom-28 z-30 md:right-1/2 md:translate-x-1/2">
            <MusicPanel unlocked={!!plan?.music} onClose={() => setMusicOpen(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black via-black/70 to-transparent px-4 pt-10 pb-6">
        <div className="glass-strong flex items-center gap-2 rounded-full p-2 md:gap-3">
          <ControlButton label={micOn ? "Mute" : "Unmute"} active={!micOn} onClick={() => setMicOn((m) => !m)}>
            {micOn ? <Mic /> : <MicOff />}
          </ControlButton>
          <ControlButton label={camOn ? "Turn camera off" : "Turn camera on"} active={!camOn} onClick={() => setCamOn((c) => !c)}>
            {camOn ? <Camera /> : <CameraOff />}
          </ControlButton>
          <ControlButton label="Music" active={musicOpen} highlight onClick={() => setMusicOpen((m) => !m)}>
            <Music2 />
          </ControlButton>
          <ControlButton label="Report" onClick={() => setReportOpen(true)}>
            <Flag />
          </ControlButton>
          <button
            type="button"
            onClick={() => void endCall()}
            aria-label="End call"
            className="grid h-12 w-16 place-items-center rounded-full bg-red-500 text-white transition-transform hover:scale-105 active:scale-95 [&_svg]:size-5"
          >
            <PhoneOff />
          </button>
        </div>
      </div>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="meeting"
        targetId={meetingId}
        targetName={partner.name}
        onReported={() => {
          toast.message("You can leave the call at any time.");
        }}
      />
    </div>
  );
}

function ControlButton({
  children,
  label,
  active,
  highlight,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-12 place-items-center rounded-full transition-all hover:scale-105 active:scale-95 [&_svg]:size-5",
        active ? (highlight ? "bg-brand text-ink" : "bg-white text-ink") : "bg-white/10 hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}
