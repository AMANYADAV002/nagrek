"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Coffee, Gift, Hotel, Lock, Snowflake, Ticket, Trophy, Utensils } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Flame } from "@/components/streak/flame";
import { Switch } from "@/components/ui/switch";
import { getPlan } from "@/lib/config/plans";
import { levelFor, STREAK_MILESTONES } from "@/lib/config/streak";
import { fireConfetti } from "@/lib/confetti";
import { track } from "@/lib/analytics";
import { rewards, sponsorFor } from "@/lib/mock/rewards";
import { mockUsers } from "@/lib/mock/users";
import { updateSession, useSession } from "@/lib/mock/session";
import { calculateStreak, milestoneProgress, rewardEligibility } from "@/lib/streak/calc";
import { cn } from "@/lib/utils";

const kindIcon = { cafe: Coffee, restaurant: Utensils, hotel: Hotel } as const;
const reasonText = {
  claimed: "Claimed",
  streak: "Keep your streak going",
  plan: "Upgrade to unlock",
  expired: "Expired",
  out_of_stock: "Out of stock",
} as const;

export function StreakView() {
  const session = useSession();
  const [leaderboard, setLeaderboard] = useState(false);
  if (!session) return null;

  const streak = calculateStreak(session.streakEvents);
  const { next, prev, progress } = milestoneProgress(streak);
  const level = levelFor(streak);
  const plan = getPlan(session.plan);
  const claimedIds = session.claimedRewards.map((c) => c.rewardId);
  const month = new Date().toLocaleString("en-IN", { month: "long" });

  function claim(rewardId: string) {
    // TODO(phase-6): server action issues a one-time code from the coupon pool (never shipped in the client bundle).
    updateSession((s) => ({ claimedRewards: [...s.claimedRewards, { rewardId, claimedAt: new Date().toISOString() }] }));
    track("reward_claimed", { rewardId });
    fireConfetti({ particleCount: 180, spread: 100 });
    toast.success("Reward claimed! Your code will be issued securely in Phase 6.");
  }

  const board = [
    ...mockUsers.map((u) => ({ id: u.id, name: u.name, streak: u.streak })),
    { id: "me", name: session.user?.name ?? "You", streak },
  ].sort((a, b) => b.streak - a.streak);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${month} streak`} title={<>Keep the <span className="text-brand">fire</span> going</>} description="A day counts when you complete at least one meeting or accept a join request that turns into one. Your streak resets at the start of each month." />

      <GlassCard strong className="relative overflow-hidden p-6 md:p-10">
        <div className="flex flex-col items-center gap-8 md:flex-row">
          <div className="relative">
            <Flame intensity={Math.min(1, streak / 30)} size={190} />
            <motion.span
              key={streak}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-x-0 bottom-6 text-center font-heading text-5xl font-bold text-ink drop-shadow"
            >
              {streak}
            </motion.span>
          </div>
          <div className="w-full flex-1 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-ink">Level · {level.name}</span>
              <span className="text-sm text-soft">{streak} day{streak === 1 ? "" : "s"} this month</span>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-soft">
                <span>{prev} days</span>
                <span>{next ? `${next - streak} more to ${next}-day milestone` : "All milestones reached!"}</span>
                <span>{next ?? prev} days</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next milestone">
                <motion.div className="h-full rounded-full bg-brand glow" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {STREAK_MILESTONES.map((m) => {
                const reached = streak >= m;
                return (
                  <motion.div
                    key={m}
                    whileHover={{ y: -3 }}
                    className={cn("rounded-2xl border p-3 text-center", reached ? "border-peach/60 bg-peach/10" : "border-white/10 bg-white/[0.02]")}
                  >
                    <Trophy className={cn("mx-auto size-5", reached ? "text-peach" : "text-white/25")} aria-hidden />
                    <p className="mt-1 font-heading text-lg">{m}</p>
                    <p className="text-[10px] text-soft">{levelFor(m).name}</p>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-soft">
              <Snowflake className="size-4 text-sky-300" aria-hidden />
              Streak freeze — protect your streak for one missed day. {session.plan === "ultra" ? "Coming soon for Ultra." : "Ultra perk, coming soon."}
            </div>
          </div>
        </div>
      </GlassCard>

      <section aria-labelledby="rewards-heading" className="space-y-4">
        <h2 id="rewards-heading" className="flex items-center gap-2 text-2xl font-medium">
          <Gift className="size-6 text-peach" aria-hidden /> Sponsor rewards
        </h2>
        <Stagger className="grid gap-4 md:grid-cols-2">
          {rewards.map((r) => {
            const sponsor = sponsorFor(r.sponsorId);
            const Icon = sponsor ? kindIcon[sponsor.kind] : Ticket;
            const elig = rewardEligibility(r, { streak, plan: session.plan, claimedIds });
            return (
              <StaggerItem key={r.id}>
                <GlassCard className={cn("flex h-full flex-col gap-4 p-5", elig.eligible && "ring-1 ring-peach/50")}>
                  <div className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-peach">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-soft">{sponsor?.name} · {sponsor?.city}</p>
                      <h3 className="text-lg font-medium">{r.title}</h3>
                      <p className="text-sm text-soft">{r.description}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-soft">
                      {r.minStreak}-day streak · {getPlan(r.minPlan)?.name}+ · {r.stock} left
                    </span>
                    {elig.eligible ? (
                      <GradientButton size="sm" onClick={() => claim(r.id)}>Claim</GradientButton>
                    ) : (
                      <span className={cn("flex items-center gap-1 rounded-full px-3 py-1.5", elig.reason === "claimed" ? "bg-green-500/15 text-green-300" : "bg-white/5 text-soft")}>
                        {elig.reason !== "claimed" && <Lock className="size-3" aria-hidden />}
                        {reasonText[elig.reason!]}
                      </span>
                    )}
                  </div>
                </GlassCard>
              </StaggerItem>
            );
          })}
        </Stagger>
        <p className="text-xs text-soft">Your plan: {plan?.name ?? "none"}. Higher plans unlock higher-value rewards.</p>
      </section>

      <GlassCard className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Leaderboard</h2>
          <label className="flex items-center gap-2 text-xs text-soft">
            Show me on the leaderboard <Switch checked={leaderboard} onCheckedChange={setLeaderboard} />
          </label>
        </div>
        <ol className="space-y-2">
          {board
            .filter((b) => b.id !== "me" || leaderboard)
            .slice(0, 6)
            .map((b, i) => (
              <li key={b.id} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", b.id === "me" ? "bg-peach/10" : "bg-white/[0.03]")}>
                <span className="w-6 font-heading text-peach">{i + 1}</span>
                <span className="flex-1">{b.name}</span>
                <span className="text-soft">🔥 {b.streak}</span>
              </li>
            ))}
        </ol>
        <p className="text-[11px] text-soft">Opt-in only. Other users appear here with their consent (mock data).</p>
      </GlassCard>
    </div>
  );
}
