"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Camera, Gift, MapPinCheck, PhoneMissed, ShieldAlert, UserPlus, Utensils } from "lucide-react";
import { toast } from "sonner";
import { CallButtons } from "@/components/calls/call-buttons";
import { useNotifications, type AppNotification } from "@/components/notifications/notifications-provider";
import { GradientButton } from "@/components/glass/gradient-button";
import { acceptJoin } from "@/lib/actions/matching";
import { respondStoryConsent } from "@/lib/actions/stories";
import { cravingEmoji } from "@/lib/data/cravings";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

/** Accepting a join ping from anywhere in the app. Returns false if it could not be accepted. */
export async function acceptJoinAndGo(note: AppNotification, router: ReturnType<typeof useRouter>, markRead: (ids: string[]) => void) {
  markRead([note.id]);
  const result = await acceptJoin(note.id);
  if (!result.ok) {
    toast.error(result.error);
    return false;
  }
  router.push(`/match/${result.matchId}/pre`);
  return true;
}

function Item({ note, onDone }: { note: AppNotification; onDone: () => void }) {
  const router = useRouter();
  const { markRead } = useNotifications();
  const [busy, setBusy] = useState(false);
  const food = note.payload.food ?? "";
  const emoji = cravingEmoji[food] ?? "🍽️";
  const unread = !note.read_at;

  let icon = <Bell className="size-4" aria-hidden />;
  let body: React.ReactNode = "New notification";
  let actions: React.ReactNode = null;

  if (note.kind === "join_request") {
    icon = <BellRing className="size-4" aria-hidden />;
    body = (
      <>
        Someone in {note.payload.area ?? "your area"} wants {food} {emoji}. Want to join?
      </>
    );
    actions = unread && (
      <div className="mt-2 flex gap-2">
        <GradientButton size="sm" variant="ghost" onClick={() => markRead([note.id])}>Decline</GradientButton>
        <GradientButton
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await acceptJoinAndGo(note, router, markRead)) onDone();
            setBusy(false);
          }}
        >
          {busy ? "Joining…" : "Accept"}
        </GradientButton>
      </div>
    );
  } else if (note.kind === "join_accepted" || note.kind === "match") {
    icon = <Utensils className="size-4" aria-hidden />;
    body = note.kind === "join_accepted" ? <>Someone accepted your {food} {emoji} request!</> : <>Someone matched with your {food} {emoji} craving!</>;
    actions = (
      <GradientButton
        size="sm"
        className="mt-2"
        onClick={() => {
          markRead([note.id]);
          onDone();
          router.push(`/match/${note.payload.matchId}/pre`);
        }}
      >
        Open match
      </GradientButton>
    );
  } else if (note.kind === "story_consent_request") {
    icon = <Camera className="size-4" aria-hidden />;
    body = `${note.payload.name ?? "Your meeting partner"} would like to share your meetup as a story. Okay with you?`;
    const answer = async (agree: boolean) => {
      setBusy(true);
      const res = await respondStoryConsent(note.payload.matchId ?? "", note.payload.from ?? "", agree);
      setBusy(false);
      markRead([note.id]);
      if (!res.ok) toast.error(res.error);
      else toast.success(agree ? "Thanks! They can post it now." : "Got it. It won't be shared.");
    };
    actions = unread && (
      <div className="mt-2 flex gap-2">
        <GradientButton size="sm" variant="ghost" disabled={busy} onClick={() => void answer(false)}>No thanks</GradientButton>
        <GradientButton size="sm" disabled={busy} onClick={() => void answer(true)}>Agree</GradientButton>
      </div>
    );
  } else if (note.kind === "story_consent_granted") {
    icon = <Camera className="size-4" aria-hidden />;
    body = `${note.payload.name ?? "Your meeting partner"} agreed. You can post your meetup story.`;
    actions = (
      <Link href={`/feedback/${note.payload.matchId}`} onClick={() => { markRead([note.id]); onDone(); }} className="mt-1 inline-block text-xs text-peach underline">
        Post story
      </Link>
    );
  } else if (note.kind === "moderation_warning") {
    icon = <ShieldAlert className="size-4" aria-hidden />;
    body = `A report about you was reviewed (${note.payload.reason ?? "community guidelines"}). Please keep meetups respectful. Repeated reports can lead to suspension.`;
    actions = (
      <Link href="/legal/guidelines" onClick={() => { markRead([note.id]); onDone(); }} className="mt-1 inline-block text-xs text-peach underline">
        Read the guidelines
      </Link>
    );
  } else if (note.kind === "call_missed") {
    icon = <PhoneMissed className="size-4" aria-hidden />;
    body = `Missed ${note.payload.kind ?? ""} call from ${note.payload.name ?? "a connection"}`;
    actions = note.payload.from && (
      <CallButtons personId={note.payload.from} name={note.payload.name ?? ""} className="mt-2" />
    );
  } else if (note.kind.startsWith("visit_") || note.kind === "reward_unlocked") {
    icon = note.kind === "reward_unlocked" ? <Gift className="size-4" aria-hidden /> : <MapPinCheck className="size-4" aria-hidden />;
    const who = note.payload.name ?? "Your connection";
    const place = note.payload.place ?? "a visit";
    const text: Record<string, string> = {
      visit_proposed: `${who} wants to meet at ${place}${note.payload.at ? ` on ${new Date(note.payload.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}.`,
      visit_accepted: `${who} confirmed your visit at ${place}.`,
      visit_declined: `${who} can't make it to ${place}.`,
      visit_cancelled: `${who} cancelled the visit at ${place}.`,
      visit_verified: note.payload.counted === "false" ? `Visit with ${who} verified.` : `Visit with ${who} verified! Your visit streak is ${note.payload.streak ?? "up"}.`,
      reward_unlocked: "You unlocked a sponsor reward. Your code is on the Streak page.",
    };
    body = text[note.kind] ?? "Visit update";
    const href = note.kind === "reward_unlocked" ? "/streak" : "/visits";
    actions = (
      <Link href={href} onClick={() => { markRead([note.id]); onDone(); }} className="mt-1 inline-block text-xs text-peach underline">
        {note.kind === "reward_unlocked" ? "See rewards" : note.kind === "visit_proposed" ? "Reply" : "Open visits"}
      </Link>
    );
  } else if (note.kind === "connection_request" || note.kind === "connection_accepted") {
    icon = <UserPlus className="size-4" aria-hidden />;
    body = note.kind === "connection_request" ? `${note.payload.name ?? "Someone"} wants to connect` : `${note.payload.name ?? "Someone"} accepted your connection`;
    actions = (
      <Link href="/connections" onClick={() => { markRead([note.id]); onDone(); }} className="mt-1 inline-block text-xs text-peach underline">
        View people
      </Link>
    );
  }

  return (
    <li className={cn("flex gap-3 rounded-xl p-3", unread ? "bg-peach/[0.07]" : "opacity-70")}>
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-peach">{icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p>{body}</p>
        <p className="mt-0.5 text-[11px] text-soft">{timeAgo(note.created_at)}</p>
        {actions}
      </div>
    </li>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const { live, notes, unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!live) return null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-soft hover:bg-white/5 hover:text-cream"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass-strong absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-2 shadow-2xl lg:right-auto lg:left-0"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button type="button" className="text-xs text-peach hover:underline" onClick={() => markRead()}>
                  Mark all read
                </button>
              )}
            </div>
            {notes.length ? (
              <ul className="max-h-96 space-y-1 overflow-y-auto">
                {notes.map((n) => (
                  <Item key={n.id} note={n} onDone={() => setOpen(false)} />
                ))}
              </ul>
            ) : (
              <p className="px-2 py-6 text-center text-sm text-soft">Nothing yet. Post a craving to get started.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
