"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GradientButton } from "@/components/glass/gradient-button";
import { PlanVisitDialog } from "@/components/visits/plan-visit-dialog";
import { answerCall, endCall, getCall, getCallIce, markCallConnected, type CallStatus, type CallView } from "@/lib/actions/calls";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePeer } from "@/lib/webrtc/use-peer";
import { cn } from "@/lib/utils";

type Media = "requesting" | "on" | "blocked";

const endedText: Partial<Record<CallStatus, string>> = {
  declined: "Call declined",
  missed: "No answer",
  cancelled: "Call cancelled",
  ended: "Call ended",
};

/**
 * A one-to-one voice or video call addressed by user id. Signalling is on the private channel
 * `call:<id>`; media goes peer-to-peer or through the app's TURN relay. Nothing is recorded.
 */
export function CallRoom({ view }: { view: CallView }) {
  const router = useRouter();
  const video = view.kind === "video";
  const first = view.partner.name.split(" ")[0];
  const [status, setStatus] = useState<CallStatus>(view.status);
  const [media, setMedia] = useState<Media>("requesting");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const ending = useRef(false);

  // Mic (and camera for video calls). The call still connects receive-only if they are blocked.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: "user" } : false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        setLocalStream(s);
        setMedia("on");
      } catch {
        if (!cancelled) setMedia("blocked");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [video]);

  useEffect(() => {
    if (localVideo.current && localStream) localVideo.current.srcObject = localStream;
  }, [localStream]);

  // Call status: Realtime for instant updates, plus polling while it rings in case an event is missed.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`call-status:${view.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${view.id}` }, (change) =>
        setStatus((change.new as { status: CallStatus }).status),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [view.id]);

  useEffect(() => {
    if (status !== "ringing") return;
    const poll = setInterval(async () => {
      const latest = await getCall(view.id);
      if (latest) setStatus(latest.status);
    }, 3000);
    return () => clearInterval(poll);
  }, [status, view.id]);

  const peer = usePeer({
    topic: `call:${view.id}`,
    me: view.me,
    partnerId: view.partner.id,
    role: view.role,
    localStream,
    enabled: status === "accepted" && media !== "requesting",
    video,
    loadIce: () => getCallIce(view.id),
    onConnected: () => void markCallConnected(view.id),
  });

  useEffect(() => {
    if (!peer.remoteStream) return;
    if (remoteVideo.current) remoteVideo.current.srcObject = peer.remoteStream;
    if (remoteAudio.current) remoteAudio.current.srcObject = peer.remoteStream;
  }, [peer.remoteStream]);

  const connected = peer.state === "connected" || peer.state === "weak";
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);

  const hangUp = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    peer.leave();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await endCall(view.id);
    setStatus((s) => (s === "ringing" ? (view.role === "a" ? "cancelled" : "declined") : "ended"));
  }, [peer, view.id, view.role]);

  // The other person hung up, or the call stopped ringing.
  useEffect(() => {
    if (peer.state === "left" && !ending.current) {
      toast.message(`${first} ended the call.`);
      void hangUp();
    }
  }, [peer.state, first, hangUp]);

  useEffect(() => {
    if (status !== "ringing" && status !== "accepted") {
      ending.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  }, [status]);

  // Caller gives up after the ring window; the server records it as missed for the callee.
  useEffect(() => {
    if (status !== "ringing" || view.role !== "a") return;
    const t = setTimeout(() => void hangUp(), 45_000);
    return () => clearTimeout(t);
  }, [status, view.role, hangUp]);

  async function answer(accept: boolean) {
    setBusy(true);
    const res = await answerCall(view.id, accept);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return setStatus("missed");
    }
    setStatus(accept ? "accepted" : "declined");
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const over = status !== "ringing" && status !== "accepted";
  const label =
    status === "ringing"
      ? view.role === "a" ? `Calling ${first}…` : `${first} is calling you`
      : over
        ? endedText[status]
        : connected
          ? `${mm}:${ss}`
          : peer.state === "failed"
            ? "Couldn't connect. Check your network."
            : peer.state === "reconnecting"
              ? "Reconnecting…"
              : "Connecting…";

  const showRemoteVideo = video && connected && !!peer.remoteStream;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black">
      <audio ref={remoteAudio} autoPlay className="hidden" />
      {video && (
        <video ref={remoteVideo} autoPlay playsInline className={cn("absolute inset-0 size-full object-cover", !showRemoteVideo && "hidden")} />
      )}

      {!showRemoteVideo && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 scale-150 opacity-50 blur-3xl" aria-hidden>
            <LayeredAvatar config={view.partner.avatar} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/80" />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
        {!showRemoteVideo && (
          <div className={cn("size-40 overflow-hidden rounded-full md:size-56", status === "ringing" && "animate-pulse")}>
            <LayeredAvatar config={view.partner.avatar} title={view.partner.name} />
          </div>
        )}
        <div className={cn(showRemoteVideo && "absolute top-6 left-6 text-left")}>
          <p className="font-heading text-3xl drop-shadow">{view.partner.name}</p>
          <p className="mt-1 text-sm text-white/75" role="status">
            {video ? "Video call" : "Voice call"} · {label}
          </p>
          {connected && (
            <p className={cn("mt-2 inline-flex items-center gap-1.5 text-xs", peer.state === "weak" ? "text-amber-300" : "text-white/60")}>
              {peer.state === "weak" ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
              {peer.state === "weak" ? "Weak network" : "Good connection"}
            </p>
          )}
          {media === "blocked" && !over && (
            <p className="mt-2 text-xs text-peach">Microphone{video ? "/camera" : ""} blocked. They can&apos;t hear you until you allow it in browser settings.</p>
          )}
        </div>

        {over && (
          <div className="flex flex-wrap justify-center gap-2">
            <GradientButton onClick={() => setPlanOpen(true)}><CalendarPlus /> Plan a visit</GradientButton>
            <GradientButton variant="glass" onClick={() => router.push("/connections")}>Back to people</GradientButton>
          </div>
        )}
      </div>

      {video && localStream && !over && (
        <div className="absolute top-6 right-4 z-20 aspect-[3/4] w-24 overflow-hidden rounded-2xl border border-white/20 bg-ink-2 shadow-2xl md:w-36">
          <video ref={localVideo} autoPlay playsInline muted className={cn("size-full -scale-x-100 object-cover", !camOn && "hidden")} />
          {!camOn && <div className="grid size-full place-items-center text-[10px] text-white/70"><CameraOff className="size-5" /></div>}
        </div>
      )}

      {!over && (
        <div className="relative z-20 flex justify-center px-4 pb-8">
          {status === "ringing" && view.role === "b" ? (
            <div className="flex gap-6">
              <button type="button" disabled={busy} onClick={() => void answer(false)} aria-label="Decline" className="grid size-16 place-items-center rounded-full bg-red-500 text-white [&_svg]:size-6">
                <PhoneOff />
              </button>
              <button type="button" disabled={busy} onClick={() => void answer(true)} aria-label="Accept" className="grid size-16 place-items-center rounded-full bg-green-500 text-white [&_svg]:size-6">
                <Phone />
              </button>
            </div>
          ) : (
            <div className="glass-strong flex items-center gap-2 rounded-full p-2 md:gap-3">
              <RoundButton label={micOn ? "Mute" : "Unmute"} active={!micOn} onClick={() => setMicOn((m) => !m)}>
                {micOn ? <Mic /> : <MicOff />}
              </RoundButton>
              {video && (
                <RoundButton label={camOn ? "Turn camera off" : "Turn camera on"} active={!camOn} onClick={() => setCamOn((c) => !c)}>
                  {camOn ? <Camera /> : <CameraOff />}
                </RoundButton>
              )}
              <RoundButton label="Plan a visit" onClick={() => setPlanOpen(true)}>
                <CalendarPlus />
              </RoundButton>
              <button
                type="button"
                onClick={() => void hangUp()}
                aria-label="Hang up"
                className="grid h-12 w-16 place-items-center rounded-full bg-red-500 text-white transition-transform hover:scale-105 active:scale-95 [&_svg]:size-5"
              >
                <PhoneOff />
              </button>
            </div>
          )}
        </div>
      )}

      <PlanVisitDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        people={[{ id: view.partner.id, name: view.partner.name }]}
        defaultPersonId={view.partner.id}
        callId={view.id}
      />
    </div>
  );
}

function RoundButton({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-12 place-items-center rounded-full transition-all hover:scale-105 active:scale-95 [&_svg]:size-5",
        active ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}
