"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Phone, Video, X } from "lucide-react";
import { toast } from "sonner";
import { startMatchCall, type CallKind } from "@/lib/actions/calls";
import { isUuid } from "@/lib/db/map";
import { useSession } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";

type Offer = { matchId: string; food: string; partnerId: string; partnerName: string };

/** Shown to both people the moment a match is mutually accepted. Either person can start the call. */
export function MatchCallPrompt() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userId = session?.user?.id;
  const live = backendEnabled() && !!userId && isUuid(userId);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState<CallKind | null>(null);

  // Read with the browser client (RLS: "your matches", signed-in profiles). A server action here
  // would queue behind every other action and stall navigation while it polls.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!live || !supabase || !userId) return;
    let cancelled = false;
    const load = async () => {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data: match } = await supabase
        .from("matches")
        .select("id, user_a, user_b, food")
        .eq("status", "live")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!match) return setOffer(null);
      const partnerId = match.user_a === userId ? match.user_b : match.user_a;
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", partnerId).maybeSingle();
      if (!cancelled) setOffer({ matchId: match.id, food: match.food, partnerId, partnerName: profile?.name ?? "Your match" });
    };
    void load();
    const channel = supabase
      .channel(`match-live:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `user_a=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `user_b=eq.${userId}` }, () => void load())
      .subscribe();
    const poll = setInterval(() => void load(), 10_000);
    const onLive = () => void load();
    window.addEventListener("nagrek:match-live", onLive);
    return () => {
      cancelled = true;
      clearInterval(poll);
      window.removeEventListener("nagrek:match-live", onLive);
      void supabase.removeChannel(channel);
    };
  }, [live, userId]);

  if (!offer || dismissed === offer.matchId || pathname.startsWith("/call/")) return null;

  async function choose(kind: CallKind) {
    if (!offer) return;
    setBusy(kind);
    const res = await startMatchCall(offer.matchId, kind);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setDismissed(offer.matchId);
    router.push(`/call/${res.callId}`);
  }

  const first = offer.partnerName.split(" ")[0];

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/80 p-4 backdrop-blur-md" role="dialog" aria-labelledby="match-call-title">
      <div className="glass-strong relative w-full max-w-md rounded-[2rem] p-8 text-center">
        <button type="button" className="absolute top-4 right-4 text-soft hover:text-cream" aria-label="Not now" onClick={() => setDismissed(offer.matchId)}>
          <X className="size-5" />
        </button>
        <p className="text-xs tracking-[0.2em] text-peach uppercase">You both said yes</p>
        <h2 id="match-call-title" className="mt-2 font-heading text-3xl font-medium">
          Call {first}?
        </h2>
        <p className="mt-2 text-sm text-soft">You matched over {offer.food}. The call uses your Nagrek account, never a phone number. Nothing is recorded. On the call, the message button opens a text box over the video.</p>
        <div className="mt-8 grid gap-3">
          <button type="button" disabled={!!busy} onClick={() => void choose("video")} className="flex h-14 items-center justify-center gap-2 rounded-full bg-brand font-semibold text-ink disabled:opacity-50">
            <Video className="size-5" /> {busy === "video" ? "Starting…" : "Video call"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void choose("voice")} className="flex h-14 items-center justify-center gap-2 rounded-full border border-white/15 font-semibold disabled:opacity-50">
            <Phone className="size-5" /> {busy === "voice" ? "Starting…" : "Voice call"}
          </button>
        </div>
      </div>
    </div>
  );
}
