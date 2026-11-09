"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

/** Loads your latest notifications and streams new ones over Supabase Realtime (RLS-filtered). */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const userId = session?.user?.id;
  const live = backendEnabled() && !!userId && isUuid(userId);
  const [notes, setNotes] = useState<AppNotification[]>([]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!live || !supabase || !userId) return;
    let cancelled = false;

    supabase
      .from("notifications")
      .select("id, kind, payload, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!cancelled && data) setNotes(data as AppNotification[]);
      });

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (change) => setNotes((list) => [change.new as AppNotification, ...list.filter((n) => n.id !== (change.new as AppNotification).id)]),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [live, userId]);

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
