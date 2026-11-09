"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, Loader2, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GradientButton } from "@/components/glass/gradient-button";
import { cravingEmoji } from "@/lib/data/cravings";
import { toneLabel } from "@/lib/format";
import { getMatchState, respondMatch, type Decision, type MatchStatus } from "@/lib/actions/matching";
import { MATCH_DECISION_MS } from "@/lib/matching/live";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MockUser } from "@/lib/types";

const DEMO_WINDOW_S = 10;
const LIVE_WINDOW_S = MATCH_DECISION_MS / 1000;

type LiveState = { status: MatchStatus; mine: Decision; theirs: Decision; decideBy: string };

const secondsUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));

/**
 * Blurred preview. The partner stays blurred until BOTH people accept.
 * Demo: 10 s and a simulated partner. Live: decisions are stored on `matches` and arrive over Realtime.
 */
export function PreMeet({ matchId, partner, food, live }: { matchId: string; partner: MockUser; food: string; live?: LiveState }) {
  const router = useRouter();
  const windowS = live ? LIVE_WINDOW_S : DEMO_WINDOW_S;
  const [left, setLeft] = useState(() => (live ? secondsUntil(live.decideBy) : DEMO_WINDOW_S));
  const [mine, setMine] = useState<Decision>(live?.mine ?? "pending");
  const [theirs, setTheirs] = useState<Decision>(live?.theirs ?? "pending");
  const [status, setStatus] = useState<MatchStatus>(live?.status ?? "pending");
  const bothAccepted = live ? status === "live" || status === "ended" : mine === "accepted" && theirs === "accepted";
  const roomUrl = live ? `/room/${matchId}` : `/room/${matchId}?with=${partner.id}&food=${encodeURIComponent(food)}`;
  const decided = useRef(false);

  useEffect(() => {
    if (bothAccepted) return;
    const t = setInterval(() => setLeft((l) => (live ? secondsUntil(live.decideBy) : Math.max(0, l - 1))), 1000);
    return () => clearInterval(t);
  }, [bothAccepted, live]);

  // Demo partner accepts ~3 s in.
  useEffect(() => {
    if (live) return;
    const t = setTimeout(() => setTheirs("accepted"), 3000);
    return () => clearTimeout(t);
  }, [live]);

  // Live: decisions stream in over Realtime, with a slow poll in case the socket drops.
  useEffect(() => {
    if (!live) return;
    const apply = (s: { status: MatchStatus; mine: Decision; theirs: Decision }) => {
      setStatus(s.status);
      setMine(s.mine);
      setTheirs(s.theirs);
    };
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel(`match:${matchId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => {
        void getMatchState(matchId).then((s) => s && apply(s));
      })
      .subscribe();
    const poll = setInterval(() => void getMatchState(matchId).then((s) => s && apply(s)), 4000);
    return () => {
      clearInterval(poll);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [live, matchId]);

  useEffect(() => {
    if (!live || status !== "skipped" || decided.current) return;
    decided.current = true;
    toast.message(mine === "skipped" ? "Skipped. We will find someone else." : "This match didn't happen this time. Try another craving.");
    router.replace("/dashboard");
  }, [live, status, mine, router]);

  useEffect(() => {
    if (left > 0 || bothAccepted || decided.current) return;
    decided.current = true;
    toast.message("Time's up — this match was skipped.");
    if (live) void respondMatch(matchId, "skipped");
    router.replace("/dashboard");
  }, [left, bothAccepted, live, matchId, router]);

  async function decide(decision: "accepted" | "skipped") {
    setMine(decision);
    if (!live) {
      if (decision === "skipped") {
        toast.message("Skipped. We will find someone else.");
        router.replace("/dashboard");
      }
      return;
    }
    const res = await respondMatch(matchId, decision);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStatus(res.status);
  }

  useEffect(() => {
    if (!bothAccepted) return;
    const t = setTimeout(() => router.push(roomUrl), 1600);
    return () => clearTimeout(t);
  }, [bothAccepted, router, roomUrl]);

  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-7 px-4 py-10 text-center">
      <div>
        <p className="text-xs tracking-[0.2em] text-peach uppercase">It&apos;s a match</p>
        <h1 className="mt-2 text-3xl font-medium">
          {partner.name.split(" ")[0]} wants {food} too {cravingEmoji[food] ?? ""}
        </h1>
        <p className="mt-1 text-sm text-soft">
          {partner.area}, {partner.city} · {toneLabel(partner.tone)} · ★ {partner.trustScore}
        </p>
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-ink-2">
        <motion.div
          className="absolute inset-0"
          animate={{ filter: bothAccepted ? "blur(0px)" : "blur(28px)", scale: bothAccepted ? 1 : 1.15 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <LayeredAvatar config={partner.avatar} title={`${partner.name}, blurred preview`} />
        </motion.div>
        {!bothAccepted && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative grid size-32 place-items-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r={R} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="6" />
                <circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke="url(#cd)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - Math.min(1, left / windowS))}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
                <defs>
                  <linearGradient id="cd" x1="0" x2="1">
                    <stop offset="0" stopColor="#ff7e5f" />
                    <stop offset="1" stopColor="#feb47b" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-heading text-5xl" aria-live="polite" aria-label={`${left} seconds left`}>{left}</span>
            </div>
          </div>
        )}
        <AnimatePresence>
          {bothAccepted && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-x-0 bottom-5 flex justify-center">
              <span className="glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <Heart className="size-4 text-peach" aria-hidden /> You both said yes — joining the table…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute top-4 left-4 flex flex-col items-start gap-1.5 text-[11px]">
          <span className="glass rounded-full px-3 py-1">You: {mine === "accepted" ? "accepted" : "deciding"}</span>
          <span className="glass rounded-full px-3 py-1">
            {partner.name.split(" ")[0]}: {theirs === "accepted" ? "accepted" : "deciding"}
          </span>
        </div>
      </div>

      {mine === "pending" ? (
        <div className="flex w-full gap-3">
          <GradientButton
            variant="glass"
            size="lg"
            className="flex-1"
            onClick={() => void decide("skipped")}
          >
            <SkipForward /> Skip
          </GradientButton>
          <GradientButton size="lg" className="flex-1" onClick={() => void decide("accepted")}>
            <Check /> Accept
          </GradientButton>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-soft">
          {bothAccepted ? (
            <>
              <Check className="size-4 text-peach" aria-hidden /> Connecting video…
            </>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin text-peach" aria-hidden /> Waiting for {partner.name.split(" ")[0]}…
            </>
          )}
        </p>
      )}
      <p className="text-[11px] text-soft">Video stays blurred until you both accept. Nothing is recorded.</p>
    </div>
  );
}
