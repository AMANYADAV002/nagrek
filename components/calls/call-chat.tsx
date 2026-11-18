"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatComposer, type ChatPiece } from "@/components/chat/chat-composer";
import { sendDirectMessage } from "@/lib/actions/history";
import { useDraft } from "@/lib/draft";
import type { CallTextMessage } from "@/lib/webrtc/types";

/** Drawer over an active call. Sending goes out on the call channel and is saved to History. */
export function CallChat({
  me,
  partnerId,
  partnerName,
  inbox,
  send,
  canSend = true,
}: {
  me: string;
  partnerId?: string;
  partnerName: string;
  inbox: CallTextMessage[];
  send: (message: CallTextMessage) => void;
  canSend?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useDraft(`call-chat-${me}`, "");
  const [mine, setMine] = useState<CallTextMessage[]>([]);
  const [readThrough, setReadThrough] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const incoming = inbox.filter((m) => m.from !== me && m.body);
  const messages = [...mine, ...incoming].sort((a, b) => a.at - b.at);
  const unread = open ? 0 : Math.max(0, incoming.length - readThrough);
  const first = partnerName.split(" ")[0];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, open]);

  function toggle() {
    setReadThrough(incoming.length);
    setOpen((v) => !v);
  }

  function deliver(piece: ChatPiece) {
    if (!canSend) return;
    const message: CallTextMessage = { id: crypto.randomUUID(), from: me, body: piece.body, at: Date.now(), kind: piece.kind };
    setMine((list) => [...list, message]);
    send(message);
    if (piece.kind === "text" || piece.kind === "emoji") setDraft("");
    if (!partnerId) return;
    void sendDirectMessage(partnerId, piece.body, piece.kind).then((res) => {
      if (!res.ok && (piece.kind === "gif" || piece.kind === "sticker")) {
        console.error("sendDirectMessage failed", res.error);
        toast.error(res.error);
      }
    }).catch((error) => {
      console.error("sendDirectMessage failed", error);
      toast.error("Could not send that.");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Messages, ${unread} new` : "Messages"}
        className="relative grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20 [&_svg]:size-5"
      >
        <MessageCircle />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-ink">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <section
          className="glass-strong fixed inset-x-3 bottom-28 z-30 flex max-h-[min(70dvh,28rem)] flex-col rounded-3xl md:inset-x-auto md:right-4 md:bottom-28 md:w-96"
          aria-label={`Messages with ${first}`}
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">Message {first}</p>
            <button type="button" onClick={toggle} aria-label="Close messages" className="text-soft hover:text-cream">
              <X className="size-4" />
            </button>
          </header>
          <div ref={listRef} className="flex min-h-48 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="m-auto text-center text-xs text-soft">
                {canSend ? "The call stays on. Messages also stay in History." : "Messages send once the call reconnects."}
              </p>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} mine={m.from === me} kind={m.kind ?? "text"} body={m.body} />
            ))}
          </div>
          <div className="border-t border-white/10 p-3">
            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSend={deliver}
              disabled={!canSend}
              placeholder={canSend ? `Message ${first}` : "Reconnecting…"}
              label={`Message ${first}`}
            />
          </div>
        </section>
      )}
    </>
  );
}
