"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, Loader2, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GradientButton } from "@/components/glass/gradient-button";
import { cravingEmoji } from "@/lib/data/cravings";
import { toneLabel } from "@/lib/format";
import type { MockUser } from "@/lib/types";

const WINDOW_S = 10;

/**
 * 10-second blurred preview. The video stays blurred until BOTH people accept.
 * TODO(phase-4): accept/skip are written to `matches` and synced over Realtime.
 */
export function PreMeet({ matchId, partner, food }: { matchId: string; partner: MockUser; food: string }) {
  const router = useRouter();
  const [left, setLeft] = useState(WINDOW_S);
  const [mine, setMine] = useState<"pending" | "accepted">("pending");
  const [theirs, setTheirs] = useState<"pending" | "accepted">("pending");
  const bothAccepted = mine === "accepted" && theirs === "accepted";
  const roomUrl = `/room/${matchId}?with=${partner.id}&food=${encodeURIComponent(food)}`;

  useEffect(() => {
    if (bothAccepted) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [bothAccepted]);

  // Mock partner decision: accepts ~3s in.
  useEffect(() => {
    const t = setTimeout(() => setTheirs("accepted"), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (left === 0 && !bothAccepted) {
      toast.message("Time's up — this match was skipped.");
      router.replace("/dashboard");
    }
  }, [left, bothAccepted, router]);

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
                  strokeDashoffset={C * (1 - left / WINDOW_S)}
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
            onClick={() => {
              toast.message("Skipped. We will find someone else.");
              router.replace("/dashboard");
            }}
          >
            <SkipForward /> Skip
          </GradientButton>
          <GradientButton size="lg" className="flex-1" onClick={() => setMine("accepted")}>
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
