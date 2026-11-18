"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Coffee, Gift, Hotel, Lock, MapPinCheck, Snowflake, Ticket, Trophy, Utensils } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Flame } from "@/components/streak/flame";
import { useLocalWeather } from "@/components/streak/use-local-weather";
import { WeatherBackdrop } from "@/components/streak/weather-backdrop";
import { Switch } from "@/components/ui/switch";
import { getPlan } from "@/lib/config/plans";
import { levelFor, STREAK_MILESTONES } from "@/lib/config/streak";
import { fireConfetti } from "@/lib/confetti";
import { track } from "@/lib/analytics";
import { claimReward, loadLeaderboard, loadRewards, setLeaderboardOptIn, type LeaderRow, type RewardsData } from "@/lib/actions/rewards";
import { rewards, sponsorFor } from "@/lib/mock/rewards";
import { backendEnabled } from "@/lib/supabase/env";
import { mockUsers } from "@/lib/mock/users";
import { updateSession, useSession } from "@/lib/mock/session";
import { calculateStreak, milestoneProgress, rewardEligibility } from "@/lib/streak/calc";
import { cn } from "@/lib/utils";

const kindIcon = { cafe: Coffee, restaurant: Utensils, hotel: Hotel } as const;
/** Demo mode has no real visits; enough to show one reward as claimable. */
const DEMO_VISIT_STREAK = 2;
const reasonText = {
  claimed: "Claimed",
  visits: "Verify more visits",
  plan: "Upgrade to unlock",
  expired: "Expired",
  out_of_stock: "Out of stock",
} as const;

export function StreakView() {
  const session = useSession();
  const live = backendEnabled();
  const [demoLeaderboard, setDemoLeaderboard] = useState(false);
  const [data, setData] = useState<RewardsData | null>(null);
  const [board, setBoard] = useState<{ rows: LeaderRow[]; optedIn: boolean } | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    void loadRewards().then(setData);
    void loadLeaderboard().then(setBoard);
  }, [live]);

  const place = session?.preferences?.location;
  const weather = useLocalWeather(place?.city, place?.point?.lat, place?.point?.lng);

  if (!session) return null;

  const streak = calculateStreak(session.streakEvents);
  const { next, prev, progress } = milestoneProgress(streak);
  const level = levelFor(streak);
  const plan = getPlan(session.plan);
  const rewardList = live ? (data?.rewards ?? []) : rewards;
  const sponsorOf = (id: string) => (live ? data?.sponsors.find((s) => s.id === id) : sponsorFor(id));
  const claims = live ? (data?.claimed ?? []) : session.claimedRewards.map((c) => ({ ...c, code: null as string | null }));
  const claimedIds = claims.map((c) => c.rewardId);
  const visits = live ? (data?.visitStreak ?? 0) : DEMO_VISIT_STREAK;
  const month = new Date().toLocaleString("en-IN", { month: "long" });

  async function claim(rewardId: string) {
    if (live) {
      setClaiming(rewardId);
      const res = await claimReward(rewardId);
      setClaiming(null);
      if (!res.ok) return toast.error(res.error);
      setData(await loadRewards());
      toast.success(`Reward claimed! Your code: ${res.code}`);
    } else {
      updateSession((s) => ({ claimedRewards: [...s.claimedRewards, { rewardId, claimedAt: new Date().toISOString() }] }));
      toast.success("Reward claimed! (Demo mode: no real code is issued.)");
    }
    track("reward_claimed", { rewardId });
    fireConfetti({ particleCount: 180, spread: 100 });
  }

  async function toggleBoard(on: boolean) {
    if (!live) return setDemoLeaderboard(on);
    setBoard((b) => (b ? { ...b, optedIn: on } : b));
    const res = await setLeaderboardOptIn(on);
    if (!res.ok) toast.error(res.error);
    setBoard(await loadLeaderboard());
  }

  const optedIn = live ? !!board?.optedIn : demoLeaderboard;
  const rows: LeaderRow[] = live
    ? (board?.rows ?? [])
    : [
        ...mockUsers.map((u) => ({ id: u.id, name: u.name, streak: u.streak, isMe: false })),
        ...(demoLeaderboard ? [{ id: "me", name: session.user?.name ?? "You", streak, isMe: true }] : []),
      ].sort((a, b) => b.streak - a.streak);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${month} streak`} title={<>Keep the <span className="text-brand">fire</span> going</>} description="A day counts when you complete at least one meeting or accept a join request that turns into one. Your streak resets at the start of each month." />

      <section className="relative overflow-hidden rounded-2xl border border-white/12 p-6 md:p-10" aria-label={`${weather.place}, ${weather.label}`}>
        <WeatherBackdrop scene={weather.scene} />
        <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row">
          <div className="relative">
            <Flame intensity={Math.min(1, streak / 30)} size={190} />
            <motion.span
              key={streak}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-x-0 bottom-6 text-center font-heading text-5xl font-bold text-cream drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
            >
              {streak}
            </motion.span>
          </div>
          <div className="w-full flex-1 space-y-5 rounded-3xl bg-ink/60 p-5 text-cream shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-md">
            <p className="text-xs text-cream/80">{weather.place} · {weather.label}</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-ink">Level · {level.name}</span>
              <span className="text-sm text-cream/75">{streak} day{streak === 1 ? "" : "s"} this month</span>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-cream/70">
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
                    className={cn("rounded-2xl border p-3 text-center backdrop-blur-sm", reached ? "border-peach/60 bg-ink/45" : "border-white/15 bg-ink/35")}
                  >
                    <Trophy className={cn("mx-auto size-5", reached ? "text-peach" : "text-white/25")} aria-hidden />
                    <p className="mt-1 font-heading text-lg">{m}</p>
                    <p className="text-[10px] text-soft">{levelFor(m).name}</p>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-ink/40 px-4 py-3 text-xs text-cream/75">
              <Snowflake className="size-4 text-sky-300" aria-hidden />
              Streak freeze — protect your streak for one missed day. {session.plan === "ultra" ? "Coming soon for Ultra." : "Ultra perk, coming soon."}
            </div>
          </div>
        </div>
      </section>

      <GlassCard className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand font-heading text-3xl font-bold text-ink">{visits}</span>
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-lg font-medium"><MapPinCheck className="size-5 text-peach" aria-hidden /> Visit streak</h2>
          <p className="text-sm text-soft">
            Meet a connection in person and scan each other&apos;s code to verify the visit. Each verified visit adds one. Sponsor rewards unlock on visits, for both of you.
            {" "}Your visit streak resets after 30 days without one.
          </p>
        </div>
        <GradientLink href="/visits" size="sm">Plan a visit</GradientLink>
      </GlassCard>

      <section aria-labelledby="rewards-heading" className="space-y-4">
        <h2 id="rewards-heading" className="flex items-center gap-2 text-2xl font-medium">
          <Gift className="size-6 text-peach" aria-hidden /> Sponsor rewards
        </h2>
        <Stagger className="grid gap-4 md:grid-cols-2">
          {rewardList.map((r) => {
            const sponsor = sponsorOf(r.sponsorId);
            const code = claims.find((c) => c.rewardId === r.id)?.code;
            const Icon = sponsor ? kindIcon[sponsor.kind] : Ticket;
            const elig = rewardEligibility(r, { visits, plan: session.plan, claimedIds });
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
                      {r.minVisits} verified visit{r.minVisits === 1 ? "" : "s"} · {getPlan(r.minPlan)?.name}+ · {r.stock} left
                    </span>
                    {elig.eligible ? (
                      <GradientButton size="sm" disabled={claiming === r.id} onClick={() => void claim(r.id)}>
                        {claiming === r.id ? "Claiming…" : "Claim"}
                      </GradientButton>
                    ) : (
                      <span className={cn("flex items-center gap-1 rounded-full px-3 py-1.5", elig.reason === "claimed" ? "bg-green-500/15 text-green-300" : "bg-white/5 text-soft")}>
                        {elig.reason !== "claimed" && <Lock className="size-3" aria-hidden />}
                        {reasonText[elig.reason!]}
                      </span>
                    )}
                  </div>
                  {code && (
                    <p className="rounded-xl border border-dashed border-peach/50 bg-peach/5 px-3 py-2 text-center font-mono text-sm tracking-wider text-peach">
                      {code}
                    </p>
                  )}
                </GlassCard>
              </StaggerItem>
            );
          })}
        </Stagger>
        {live && !data && <p className="text-sm text-soft">Loading rewards…</p>}
        <p className="text-xs text-soft">Your plan: {plan?.name ?? "none"}. Higher plans unlock higher-value rewards.</p>
      </section>

      <GlassCard className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Leaderboard</h2>
          <label className="flex items-center gap-2 text-xs text-soft">
            Show me on the leaderboard <Switch checked={optedIn} onCheckedChange={(on) => void toggleBoard(on)} />
          </label>
        </div>
        {live && board && rows.length === 0 && <p className="text-sm text-soft">No one has opted in this month yet. Be the first!</p>}
        <ol className="space-y-2">
          {rows
            .slice(0, live ? 10 : 6)
            .map((b, i) => (
              <li key={b.id} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", b.isMe ? "bg-peach/10" : "bg-white/[0.03]")}>
                <span className="w-6 font-heading text-peach">{i + 1}</span>
                <span className="flex-1">{b.name}</span>
                <span className="text-soft">🔥 {b.streak}</span>
              </li>
            ))}
        </ol>
        <p className="text-[11px] text-soft">Opt-in only. Only first names and streaks are shown{live ? "" : " (demo data)"}.</p>
      </GlassCard>
    </div>
  );
}
