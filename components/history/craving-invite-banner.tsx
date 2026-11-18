"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { GradientButton } from "@/components/glass/gradient-button";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { respondCravingInvite } from "@/lib/actions/history";
import { cravingEmoji } from "@/lib/data/cravings";

/** Accept or reject a craving sent from History, without leaving the current page. */
export function CravingInviteBanner() {
  const { notes, markRead, live } = useNotifications();
  const note = live ? notes.find((item) => item.kind === "craving_invite" && !item.read_at) : undefined;
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  if (!note) return null;
  const food = note.payload.food ?? "something";
  const name = note.payload.name ?? "Someone";

  async function answer(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    const res = await respondCravingInvite(note!.payload.inviteId ?? "", accept);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    markRead([note!.id]);
    if (accept) {
      toast.success("You're on. You can call, message, and pick a place.");
      window.dispatchEvent(new Event("nagrek:match-live"));
    } else toast.message("Request declined. Your chat is still there.");
  }

  return (
    <div role="alert" className="glass-strong flex flex-wrap items-center gap-4 rounded-2xl p-4 ring-1 ring-peach/40">
      <span className="grid size-11 place-items-center rounded-full bg-peach/15 text-peach">
        <BellRing className="size-5" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold">
        {name} wants to meet again for {food} {cravingEmoji[food] ?? ""}.
      </p>
      <div className="flex gap-2">
        <GradientButton size="sm" variant="ghost" disabled={!!busy} onClick={() => void answer(false)}>
          {busy === "decline" ? "Declining…" : "Reject"}
        </GradientButton>
        <GradientButton size="sm" disabled={!!busy} onClick={() => void answer(true)}>
          {busy === "accept" ? "Accepting…" : "Accept"}
        </GradientButton>
      </div>
    </div>
  );
}
