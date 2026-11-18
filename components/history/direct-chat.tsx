"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { CallButtons } from "@/components/calls/call-buttons";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatComposer, type ChatPiece } from "@/components/chat/chat-composer";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { CraveAgainDialog } from "@/components/history/crave-again-dialog";
import { PlanVisitDialog } from "@/components/visits/plan-visit-dialog";
import { loadThread, sendDirectMessage, sendVoiceNote, type DirectMessage } from "@/lib/actions/history";
import { orderedPair } from "@/lib/history/pair";
import { restaurantHref } from "@/lib/places/query";
import { useSession } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AvatarConfig } from "@/lib/types";

interface Partner {
  id: string;
  name: string;
  avatar: AvatarConfig;
}

/** Persistent text and voice notes with one person from History. */
export function DirectChat({ partnerId }: { partnerId: string }) {
  const me = useSession()?.user?.id;
  const [partner, setPartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [food, setFood] = useState<string | null>(null);
  const [hasPlace, setHasPlace] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [craveOpen, setCraveOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadThread(partnerId).then((res) => {
      if (cancelled) return;
      if ("error" in res) return setError(res.error);
      setPartner(res.partner);
      setMessages(res.messages);
      setLiveMatchId(res.liveMatchId);
      setFood(res.food);
      setHasPlace(res.hasPlace);
      setWarning("warning" in res ? res.warning : "");
    });
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!me || !supabase) return;
    const [low, high] = orderedPair(me, partnerId);
    const channel = supabase
      .channel(`direct:${low}:${high}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `pair_low=eq.${low}` }, () => {
        void loadThread(partnerId).then((res) => {
          if ("error" in res) return;
          setMessages(res.messages);
          setLiveMatchId(res.liveMatchId);
        });
      })
      .subscribe();
    const onFocus = () => {
      void loadThread(partnerId).then((res) => {
        if ("error" in res) return;
        setMessages(res.messages);
        setLiveMatchId(res.liveMatchId);
      });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [me, partnerId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => () => {
    const rec = recorder.current;
    recorder.current = null;
    if (!rec || rec.state === "inactive") return;
    rec.onstop = null;
    rec.stop();
    rec.stream.getTracks().forEach((track) => track.stop());
  }, []);

  async function deliver(piece: ChatPiece) {
    if (!me) return;
    const optimistic: DirectMessage = { id: `local-${Date.now()}`, from: me, kind: piece.kind, body: piece.body, at: new Date().toISOString(), url: null };
    setMessages((list) => [...list, optimistic]);
    if (piece.kind === "text" || piece.kind === "emoji") setDraft("");
    setSending(true);
    try {
      const res = await sendDirectMessage(partnerId, piece.body, piece.kind);
      setSending(false);
      if (!res.ok) {
        console.error("sendDirectMessage failed", res.error);
        setMessages((list) => list.filter((item) => item.id !== optimistic.id));
        if (piece.kind === "text" || piece.kind === "emoji") setDraft(piece.body);
        return toast.error(res.error);
      }
      setMessages((list) => list.map((item) => (item.id === optimistic.id ? res.message : item)));
    } catch (error) {
      console.error("sendDirectMessage failed", error);
      setSending(false);
      setMessages((list) => list.filter((item) => item.id !== optimistic.id));
      if (piece.kind === "text" || piece.kind === "emoji") setDraft(piece.body);
      toast.error("Could not send that.");
    }
  }

  async function toggleRecord() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        void sendBlob(blob);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      window.setTimeout(() => {
        if (rec.state === "recording") rec.stop();
        setRecording(false);
      }, 15_000);
    } catch {
      toast.error("Microphone is blocked.");
    }
  }

  async function sendBlob(blob: Blob) {
    if (blob.size < 80) return;
    if (blob.size > 300_000) return toast.error("Keep the voice note under 15 seconds.");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(blob);
    });
    const mime = blob.type.includes("mp4") ? "audio/mp4" : blob.type.includes("ogg") ? "audio/ogg" : blob.type.includes("mpeg") ? "audio/mpeg" : "audio/webm";
    setSending(true);
    const res = await sendVoiceNote(partnerId, data, mime);
    setSending(false);
    if (!res.ok) return toast.error(res.error);
    setMessages((list) => (list.some((item) => item.id === res.message.id) ? list : [...list, res.message]));
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/history" className="inline-flex items-center gap-2 text-sm text-soft"><ArrowLeft className="size-4" /> History</Link>
        <p className="text-sm text-soft">{error}</p>
      </div>
    );
  }

  if (!partner) return <p className="text-sm text-soft">Opening the chat…</p>;
  const first = partner.name.split(" ")[0];

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/history" aria-label="Back to history" className="text-soft hover:text-cream"><ArrowLeft className="size-5" /></Link>
        <span className="size-11 overflow-hidden rounded-full">
          <LayeredAvatar config={partner.avatar} title={partner.name} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{partner.name}</p>
          <p className="text-xs text-soft">{liveMatchId ? "New craving is on. Call or pick a place." : "Message anytime"}</p>
        </div>
        <CallButtons personId={partner.id} name={partner.name} />
        {!hasPlace && (
          <GradientLink size="sm" href={restaurantHref({ withId: partner.id, name: partner.name, food })}>
            <MapPin className="size-4" /> Select a Restaurant
          </GradientLink>
        )}
        <GradientButton size="sm" variant="ghost" onClick={() => setPlanOpen(true)}><MapPin className="size-4" /> Place</GradientButton>
        <GradientButton size="sm" onClick={() => setCraveOpen(true)}>Crave again</GradientButton>
      </header>
      {warning && <p className="text-sm text-soft">{warning}</p>}

      <div ref={listRef} className="glass flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-3xl p-4" aria-label={`Messages with ${first}`}>
        {messages.length === 0 && <p className="m-auto text-sm text-soft">Say hello. This chat stays after the craving ends.</p>}
        {messages.map((message) => (
          <ChatBubble key={message.id} mine={message.from === me} kind={message.kind} body={message.body} url={message.url} />
        ))}
      </div>

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSend={(piece) => void deliver(piece)}
        disabled={sending}
        placeholder={`Message ${first}`}
        label={`Message ${first}`}
        leading={
          <button type="button" aria-label={recording ? "Stop voice note" : "Record a voice note"} onClick={() => void toggleRecord()} className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10">
            {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
          </button>
        }
      />

      <CraveAgainDialog open={craveOpen} onOpenChange={setCraveOpen} partnerId={partner.id} partnerName={partner.name} />
      <PlanVisitDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        people={[{ id: partner.id, name: partner.name }]}
        defaultPersonId={partner.id}
        craving={food}
        onPlanned={() => toast.success("Place invite sent. It shows in History once they accept.")}
      />
    </div>
  );
}
