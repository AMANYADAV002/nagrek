"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Clock, Flame, MapPin, Radar, Search, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { Chip } from "@/components/glass/chip";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { Eyebrow } from "@/components/glass/section-heading";
import { StoriesRow } from "@/components/stories/stories-row";
import { getPlan } from "@/lib/config/plans";
import { cravingEmoji, cuisineChips } from "@/lib/data/cravings";
import { track } from "@/lib/analytics";
import { toneLabel, uid } from "@/lib/format";
import {
  findLiveMatches, joinPingCandidates, LOW_TRAFFIC_THRESHOLD, REQUEST_TTL_MS,
} from "@/lib/matching/live";
import { useSession } from "@/lib/mock/session";
import { getMockUser } from "@/lib/mock/users";
import { calculateStreak } from "@/lib/streak/calc";
import type { MockUser } from "@/lib/types";

type Phase =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "live"; matches: { user: MockUser; score: number; distanceKm?: number }[]; expiresAt: number }
  | { kind: "pinged"; pinged: MockUser[]; expiresAt: number; acceptedBy?: MockUser };

export function DashboardView() {
  const router = useRouter();
  const session = useSession();
  const [craving, setCraving] = useState<string>("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [incoming, setIncoming] = useState<{ user: MockUser; food: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [matchesToday, setMatchesToday] = useState(1);

  const prefs = session?.preferences;
  const plan = getPlan(session?.plan);
  const limit = plan?.dailyMatches ?? 0;
  const excluded = session ? [...session.blocked] : [];

  // Simulated incoming "request to join" ping. TODO(phase-4): Supabase Realtime `notifications` channel + Web Push.
  useEffect(() => {
    if (!session?.notificationsEnabled) return;
    const t = setTimeout(() => {
      const u = getMockUser("u-meera");
      if (u && !session.blocked.includes(u.id)) setIncoming({ user: u, food: u.foodInterests[0] });
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.notificationsEnabled]);

  // Countdown tick for active requests; expires them after REQUEST_TTL_MS.
  useEffect(() => {
    if (phase.kind !== "live" && phase.kind !== "pinged") return;
    const deadline = phase.expiresAt;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= deadline) {
        setPhase({ kind: "idle" });
        toast.message("Your request expired. Post a new craving anytime.");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const expiresAt = phase.kind === "live" || phase.kind === "pinged" ? phase.expiresAt : 0;
  const remaining = Math.max(0, expiresAt - now);

  if (!session || !prefs) return null;
  const myPrefs = prefs;

  async function search() {
    if (!craving) return toast.error("Pick what you are craving first.");
    if (limit !== "unlimited" && matchesToday >= limit) return toast.error(`You have used all ${limit} matches today. Upgrade for more.`);
    setPhase({ kind: "searching" });
    // TODO(phase-4): insert into `match_requests` (food, tone, location, expires_at) and query candidates server-side.
    await new Promise((r) => setTimeout(r, 2200));
    const live = findLiveMatches(myPrefs, craving, excluded);
    const expires = Date.now() + REQUEST_TTL_MS;
    setNow(Date.now());
    if (live.length >= LOW_TRAFFIC_THRESHOLD) {
      setPhase({ kind: "live", matches: live, expiresAt: expires });
      return;
    }
    const pinged = joinPingCandidates(myPrefs, craving, excluded);
    const pool = pinged.length ? pinged : live.map((l) => l.user);
    setPhase({ kind: "pinged", pinged: pool, expiresAt: expires });
    if (pool.length) {
      setTimeout(() => {
        setPhase((p) => (p.kind === "pinged" ? { ...p, acceptedBy: pool[0] } : p));
        toast.success(`${pool[0].name.split(" ")[0]} wants to join you for ${craving}!`);
      }, 3500);
    }
  }

  function startMatch(user: MockUser, food: string) {
    setMatchesToday((n) => n + 1);
    track("match", { food, with: user.id });
    router.push(`/match/${uid("m")}/pre?with=${user.id}&food=${encodeURIComponent(food)}`);
  }

  const streak = calculateStreak(session.streakEvents);
  const chips = [...new Set([...myPrefs.foodInterests, ...cuisineChips])].slice(0, 14);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {incoming && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            role="alert"
            className="glass-strong flex flex-wrap items-center gap-4 rounded-2xl p-4 ring-1 ring-peach/40"
          >
            <span className="relative grid size-11 place-items-center rounded-full bg-peach/15 text-peach">
              <span className="animate-pulse-ring absolute inset-0 rounded-full border border-peach/50" />
              <BellRing className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Someone nearby wants {incoming.food} {cravingEmoji[incoming.food] ?? ""}. Want to join?
              </p>
              <p className="text-xs text-soft">
                {incoming.user.area} · {toneLabel(incoming.user.tone)} · matches your saved interests
              </p>
            </div>
            <div className="flex gap-2">
              <GradientButton size="sm" variant="ghost" onClick={() => setIncoming(null)}>
                Decline
              </GradientButton>
              <GradientButton
                size="sm"
                onClick={() => {
                  const inc = incoming;
                  setIncoming(null);
                  startMatch(inc.user, inc.food);
                }}
              >
                Accept
              </GradientButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GlassCard className="p-5">
        <StoriesRow />
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <GlassCard strong className="relative overflow-hidden p-6 md:p-8">
          <div aria-hidden className="absolute -top-28 -right-28 size-80 rounded-full bg-[radial-gradient(ellipse,#ff7e5f2e,transparent_70%)]" />
          <Eyebrow>Hi {session.user?.name.split(" ")[0]}</Eyebrow>
          <h1 className="relative mt-3 text-3xl font-medium md:text-4xl">
            What are you <span className="text-brand">craving</span> right now?
          </h1>
          <p className="relative mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-soft">
            <span className="flex items-center gap-1"><MapPin className="size-3.5 text-peach" aria-hidden /> {myPrefs.location.area ? `${myPrefs.location.area}, ` : ""}{myPrefs.location.city}</span>
            <span>{toneLabel(myPrefs.tone)}</span>
            <span>
              {limit === "unlimited" ? "Unlimited matches" : `${Math.max(0, limit - matchesToday)} of ${limit} matches left today`}
            </span>
          </p>

          <AnimatePresence mode="wait">
            {phase.kind === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <Chip key={c} selected={craving === c} showCheck={false} onClick={() => setCraving(c)}>
                      <span aria-hidden>{cravingEmoji[c] ?? "🍽️"}</span> {c}
                    </Chip>
                  ))}
                </div>
                <GradientButton size="lg" onClick={search} disabled={!craving}>
                  <Search /> Find my table
                </GradientButton>
              </motion.div>
            )}

            {phase.kind === "searching" && (
              <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative mt-8 flex flex-col items-center gap-5 py-6" aria-live="polite">
                <div className="relative grid size-40 place-items-center">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="absolute inset-0 rounded-full border border-peach/40"
                      animate={{ scale: [0.4, 1.3], opacity: [0.8, 0] }}
                      transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }}
                    />
                  ))}
                  <span className="grid size-16 place-items-center rounded-full bg-brand text-3xl glow">{cravingEmoji[craving] ?? "🍽️"}</span>
                </div>
                <p className="text-sm text-soft">Looking for people near you who want {craving}…</p>
              </motion.div>
            )}

            {(phase.kind === "live" || phase.kind === "pinged") && (
              <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-soft">
                  <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-peach" aria-hidden /> Request expires in {mm}:{ss}</span>
                  <button type="button" className="flex items-center gap-1 hover:text-cream" onClick={() => setPhase({ kind: "idle" })}>
                    <X className="size-3.5" aria-hidden /> Cancel request
                  </button>
                </div>

                {phase.kind === "live" &&
                  phase.matches.map(({ user, score, distanceKm }, i) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <Link href={`/profile/${user.id}`} className="size-12 shrink-0 overflow-hidden rounded-full">
                        <LayeredAvatar config={user.avatar} title={user.name} />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{user.name}</p>
                        <p className="text-xs text-soft">
                          {user.area} · {distanceKm !== undefined ? `~${Math.max(1, Math.round(distanceKm))} km` : user.city} · ★ {user.trustScore}
                        </p>
                      </div>
                      <span className="hidden rounded-full bg-peach/15 px-2.5 py-1 text-xs font-bold text-peach sm:inline">{score}% match</span>
                      <GradientButton size="sm" onClick={() => startMatch(user, craving)}>Match</GradientButton>
                    </motion.div>
                  ))}

                {phase.kind === "pinged" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                      <p className="flex items-center gap-2 font-semibold"><Send className="size-4 text-peach" aria-hidden /> It is quiet right now</p>
                      <p className="mt-1 text-soft">
                        We sent &quot;Someone nearby wants {craving}. Want to join?&quot; to {phase.pinged.length} {phase.pinged.length === 1 ? "person" : "people"} who saved {craving} as a favourite.
                        Pings respect their notification settings and daily limits.
                      </p>
                    </div>
                    {phase.acceptedBy ? (
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4 rounded-2xl bg-peach/10 p-4 ring-1 ring-peach/40">
                        <div className="size-12 shrink-0 overflow-hidden rounded-full"><LayeredAvatar config={phase.acceptedBy.avatar} /></div>
                        <p className="flex-1 text-sm"><strong>{phase.acceptedBy.name}</strong> accepted your request!</p>
                        <GradientButton size="sm" onClick={() => startMatch(phase.acceptedBy!, craving)}>Continue</GradientButton>
                      </motion.div>
                    ) : phase.pinged.length ? (
                      <p className="flex items-center gap-2 text-xs text-soft"><Radar className="size-4 animate-spin text-peach [animation-duration:3s]" aria-hidden /> Waiting for someone to accept…</p>
                    ) : (
                      <p className="text-sm text-soft">Nobody has saved {craving} yet. Try another craving or check back soon.</p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        <div className="space-y-6">
          <Link href="/streak" className="block">
            <GlassCard className="flex items-center gap-4 p-5 transition-colors hover:bg-white/[0.06]">
              <span className="text-4xl animate-flicker" aria-hidden>🔥</span>
              <div className="flex-1">
                <p className="font-heading text-2xl">{streak}-day streak</p>
                <p className="text-xs text-soft">Keep meeting to unlock sponsor rewards</p>
              </div>
              <Flame className="size-5 text-peach" aria-hidden />
            </GlassCard>
          </Link>
          <GlassCard className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-peach" aria-hidden /> Quick links</p>
            {[
              { href: "/explore", label: "Explore places near you" },
              { href: "/wishlist", label: "Plan from your wish list" },
              { href: "/connections", label: `${Object.values(session.connections).filter((c) => c === "pending-in").length} connection requests` },
              { href: "/avatar", label: "Customise your avatar" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 text-sm hover:bg-white/[0.07]">
                {l.label} <span className="text-peach">→</span>
              </Link>
            ))}
          </GlassCard>
          <GlassCard className="flex items-center gap-3 p-5 text-xs text-soft">
            <Bell className="size-4 text-peach" aria-hidden />
            Join-request notifications are {session.notificationsEnabled ? "on" : "off"}. Change this in your profile.
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
