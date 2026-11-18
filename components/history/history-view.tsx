"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, MessageCircle, Utensils } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { EmptyState } from "@/components/glass/states";
import { CraveAgainDialog } from "@/components/history/crave-again-dialog";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { loadHistory, respondCravingInvite, type HistoryEntry } from "@/lib/actions/history";
import { cravingEmoji } from "@/lib/data/cravings";
import { restaurantHref } from "@/lib/places/query";
import { useSession } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Past matches, with the last craving, venue, and a way back into chat. */
export function HistoryView() {
  const session = useSession();
  const { notes } = useNotifications();
  const live = backendEnabled();
  const userId = session?.user?.id;
  const stamp = notes.filter((note) => note.kind.startsWith("visit_") || note.kind.startsWith("craving_")).map((note) => note.id).join("|");
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [cravingFor, setCravingFor] = useState<HistoryEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await loadHistory();
    setRows(next ?? []);
  }, []);

  useEffect(() => {
    if (!live || !userId) return;
    let cancelled = false;
    void loadHistory().then((next) => {
      if (!cancelled) setRows(next ?? []);
    });
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel(`history:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, () => void reload())
      .subscribe();
    return () => {
      cancelled = true;
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [live, userId, stamp, reload]);

  async function answer(entry: HistoryEntry, accept: boolean) {
    if (!entry.invite) return;
    setBusy(entry.invite.id);
    const res = await respondCravingInvite(entry.invite.id, accept);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    if (accept) {
      toast.success("You're on. You can call, message, and pick a place.");
      window.dispatchEvent(new Event("nagrek:match-live"));
    } else toast.message("Request declined.");
    await reload();
  }

  if (!live) {
    return (
      <EmptyState
        icon={<Clock className="size-8" />}
        title="History stays with your account"
        description="Sign in to see the people you've matched with, what you ate, and where you met."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Past meetups"
        title={<>Your <span className="text-brand">history</span></>}
        description="Everyone you've matched with. Message them anytime, or send a new craving when you want to meet again."
      />
      {!rows ? (
        <p className="text-sm text-soft">Loading your history…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Utensils className="size-8" />} title="No past meetups yet" description="When you match with someone, they stay here with the craving and the place you picked." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((entry) => (
            <li key={entry.partner.id}>
              <GlassCard className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="size-12 shrink-0 overflow-hidden rounded-full">
                    <LayeredAvatar config={entry.partner.avatar} title={entry.partner.name} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{entry.partner.name}</p>
                    <p className="text-xs text-soft">{when(entry.metAt)}</p>
                  </div>
                </div>
                <p className="text-sm">
                  {cravingEmoji[entry.food] ?? "🍽️"} {entry.food}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-soft">
                  <MapPin className="size-4 text-peach" aria-hidden /> {entry.placeName ?? "No venue yet"}
                </p>
                {entry.invite?.incoming && (
                  <p className="text-xs text-peach">Wants {entry.invite.food} again.</p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {!entry.placeName && (
                    <GradientLink size="sm" href={restaurantHref({ withId: entry.partner.id, name: entry.partner.name, food: entry.food })}>
                      <MapPin className="size-4" /> Select a Restaurant
                    </GradientLink>
                  )}
                  <Link href={`/history/${entry.partner.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm">
                    <MessageCircle className="size-4" aria-hidden /> Message
                  </Link>
                  {entry.invite?.incoming ? (
                    <>
                      <GradientButton size="sm" variant="ghost" disabled={busy === entry.invite.id} onClick={() => void answer(entry, false)}>Reject</GradientButton>
                      <GradientButton size="sm" disabled={busy === entry.invite.id} onClick={() => void answer(entry, true)}>Accept</GradientButton>
                    </>
                  ) : (
                    <GradientButton size="sm" disabled={!!entry.invite} onClick={() => setCravingFor(entry)}>
                      {entry.invite ? "Request sent" : "Crave again"}
                    </GradientButton>
                  )}
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
      {cravingFor && (
        <CraveAgainDialog
          open
          onOpenChange={(open) => {
            if (!open) setCravingFor(null);
          }}
          partnerId={cravingFor.partner.id}
          partnerName={cravingFor.partner.name}
          onSent={() => void reload()}
        />
      )}
    </div>
  );
}
