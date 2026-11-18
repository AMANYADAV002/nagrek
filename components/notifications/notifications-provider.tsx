"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { isUuid } from "@/lib/db/map";
import { useSession } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";

export type NotificationKind = "join_request" | "join_accepted" | "match" | "connection_request" | "connection_accepted" | (string & {});

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  payload: Record<string, string | undefined>;
  read_at: string | null;
  created_at: string;
}

interface NotificationsValue {
  live: boolean;
  notes: AppNotification[];
  unread: number;
  markRead: (ids?: string[]) => void;
}

const Ctx = createContext<NotificationsValue>({ live: false, notes: [], unread: 0, markRead: () => {} });

const TOAST_KINDS = new Set([
  "join_request",
  "join_accepted",
  "match",
  "match_accepted",
  "connection_request",
  "connection_accepted",
  "visit_proposed",
  "visit_accepted",
  "visit_declined",
  "visit_cancelled",
  "craving_invite",
  "craving_accepted",
  "craving_declined",
]);

function noticeText(note: AppNotification) {
  const food = note.payload.food ? ` for ${note.payload.food}` : "";
  if (note.kind === "join_request") return `Someone wants to join you${food}.`;
  if (note.kind === "join_accepted" || note.kind === "match" || note.kind === "match_accepted") return `Your request${food} was accepted.`;
  if (note.kind === "connection_request") return "New connection request.";
  if (note.kind === "connection_accepted") return "They accepted your connection.";
  if (note.kind === "visit_proposed") return "New meetup invite.";
  if (note.kind === "visit_accepted") return "Your meetup invite was accepted.";
  if (note.kind === "visit_declined") return "Your meetup invite was declined.";
  if (note.kind === "visit_cancelled") return "A meetup was cancelled.";
  if (note.kind === "craving_invite") return `${note.payload.name ?? "Someone"} wants to meet again${food}.`;
  if (note.kind === "craving_accepted") return `Your new craving${food} was accepted.`;
  if (note.kind === "craving_declined") return `Your new craving${food} was declined.`;
  return "New notification.";
}

function sameNotes(prev: AppNotification[], next: AppNotification[]) {
  return prev.length === next.length && prev.every((note, i) => note.id === next[i]?.id && note.read_at === next[i]?.read_at);
}

/** Loads your latest notifications and streams new ones over Supabase Realtime (RLS-filtered). */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const userId = session?.user?.id;
  const live = backendEnabled() && !!userId && isUuid(userId);
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);
  const primed = useRef(false);
  const seen = useRef(new Set<string>());
  const openedAt = useRef(0);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!live || !supabase || !userId) return;
    let cancelled = false;
    primed.current = false;
    seen.current = new Set();
    openedAt.current = Date.now();

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, kind, payload, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (cancelled || !data) return;
      const next = data as AppNotification[];
      setNotes((prev) => (sameNotes(prev, next) ? prev : next));
      setReady(true);
    };

    void load();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    const poll = setInterval(() => void load(), 5_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      setReady(false);
      void supabase.removeChannel(channel);
    };
  }, [live, userId]);

  useEffect(() => {
    if (!ready) return;
    if (!primed.current) {
      primed.current = true;
      seen.current = new Set(notes.map((note) => note.id));
      return;
    }
    for (const note of notes) {
      if (seen.current.has(note.id)) continue;
      seen.current.add(note.id);
      if (note.read_at || !TOAST_KINDS.has(note.kind)) continue;
      if (new Date(note.created_at).getTime() < openedAt.current - 5_000) continue;
      toast.message(noticeText(note));
    }
  }, [notes, ready]);

  const markRead = useCallback(
    (ids?: string[]) => {
      const now = new Date().toISOString();
      const target = ids ?? notes.filter((n) => !n.read_at).map((n) => n.id);
      if (!target.length) return;
      setNotes((list) => list.map((n) => (target.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
      void getSupabaseBrowserClient()?.from("notifications").update({ read_at: now }).in("id", target);
    },
    [notes],
  );

  const value = useMemo(
    () => ({ live, notes: live ? notes : [], unread: live ? notes.filter((n) => !n.read_at).length : 0, markRead }),
    [live, notes, markRead],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  return useContext(Ctx);
}
