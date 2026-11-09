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
import { acceptJoinAndGo } from "@/components/notifications/notification-bell";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { cancelCraving, getMatchQuota, postCraving, proposeMatch, type Quota } from "@/lib/actions/matching";
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
import { backendEnabled } from "@/lib/supabase/env";
import type { MockUser } from "@/lib/types";

type LiveMatch = { user: MockUser; score: number; distanceKm?: number; requestId?: string };

type Phase =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "live"; matches: LiveMatch[]; expiresAt: number }
  | { kind: "pinged"; pinged: MockUser[]; count: number; matches: LiveMatch[]; expiresAt: number; acceptedBy?: MockUser };

export function DashboardView() {
  const router = useRouter();
  const session = useSession();
  const live = backendEnabled();
  const { notes, markRead } = useNotifications();
  const [craving, setCraving] = useState<string>("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [incoming, setIncoming] = useState<{ user: MockUser; food: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [matchesToday, setMatchesToday] = useState(1);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busy, setBusy] = useState(false);

  const prefs = session?.preferences;
  const plan = getPlan(session?.plan);
  const limit: number | "unlimited" = live
    ? quota
      ? (quota.limit ?? "unlimited")
      : (plan?.dailyMatches ?? 0)
    : (plan?.dailyMatches ?? 0);
  const used = live ? (quota?.used ?? 0) : matchesToday;
  const excluded = session ? [...session.blocked] : [];

  // Live: someone nearby pinged me, or my request was accepted / matched.
  const joinPing = live ? notes.find((n) => n.kind === "join_request" && !n.read_at) : undefined;
  const ready = live ? notes.find((n) => (n.kind === "join_accepted" || n.kind === "match") && !n.read_at) : undefined;

  useEffect(() => {
    if (live) void getMatchQuota().then(setQuota);
  }, [live]);

  // Demo only: a simulated incoming "request to join" ping. Live pings arrive as notifications.
  useEffect(() => {
    if (live || !session?.notificationsEnabled) return;
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
    if (limit !== "unlimited" && used >= limit) return toast.error(`You have used all ${limit} matches today. Upgrade for more.`);
    setPhase({ kind: "searching" });

    if (live) {
      const [res] = await Promise.all([postCraving(craving), new Promise((r) => setTimeout(r, 1200))]);
      if (!res.ok) {
        setPhase({ kind: "idle" });
        return toast.error(res.error);
      }
      setQuota(res.quota);
      setNow(Date.now());
      const expiresAt = new Date(res.expiresAt).getTime();
      const matches = res.matches.map((c) => ({ user: c.person, score: c.score, distanceKm: c.distanceKm, requestId: c.requestId }));
      track("craving", { food: craving, live: matches.length, pinged: res.pinged });
      if (matches.length >= LOW_TRAFFIC_THRESHOLD) setPhase({ kind: "live", matches, expiresAt });
      else setPhase({ kind: "pinged", pinged: [], count: res.pinged, matches, expiresAt });
      return;
    }

    await new Promise((r) => setTimeout(r, 2200));
    const found = findLiveMatches(myPrefs, craving, excluded);
    const expires = Date.now() + REQUEST_TTL_MS;
    setNow(Date.now());
    if (found.length >= LOW_TRAFFIC_THRESHOLD) {
      setPhase({ kind: "live", matches: found, expiresAt: expires });
      return;
    }
    const pinged = joinPingCandidates(myPrefs, craving, excluded);
    const pool = pinged.length ? pinged : found.map((l) => l.user);
    setPhase({ kind: "pinged", pinged: pool, count: pool.length, matches: [], expiresAt: expires });
    if (pool.length) {
      setTimeout(() => {
        setPhase((p) => (p.kind === "pinged" ? { ...p, acceptedBy: pool[0] } : p));
        toast.success(`${pool[0].name.split(" ")[0]} wants to join you for ${craving}!`);
      }, 3500);
    }
  }

  async function startMatch(user: MockUser, food: string, requestId?: string) {
    track("match", { food, with: user.id });
    if (live && requestId) {
      setBusy(true);
      const res = await proposeMatch(requestId);
      setBusy(false);
      if (!res.ok) return toast.error(res.error);
      router.push(`/match/${res.matchId}/pre`);
      return;
    }
    setMatchesToday((n) => n + 1);
    router.push(`/match/${uid("m")}/pre?with=${user.id}&food=${encodeURIComponent(food)}`);
  }

  function openReady() {
    if (!ready) return;
    markRead([ready.id]);
    router.push(`/match/${ready.payload.matchId}/pre`);
  }

  function cancelRequest() {
    setPhase({ kind: "idle" });
    if (live) void cancelCraving();
  }

  const streak = calculateStreak(session.streakEvents);
  const chips = [...new Set([...myPrefs.foodInterests, ...cuisineChips])].slice(0, 14);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {(joinPing || ready) && (
          <motion.div
            key={(ready ?? joinPing)!.id}
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
            {ready ? (
              <>
                <p className="min-w-0 flex-1 text-sm font-semibold">
                  {ready.kind === "join_accepted" ? "Someone accepted your" : "Someone matched with your"} {ready.payload.food}{" "}
                  {cravingEmoji[ready.payload.food ?? ""] ?? ""} request!
                </p>
                <GradientButton size="sm" onClick={openReady}>Open match</GradientButton>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    Someone nearby wants {joinPing!.payload.food} {cravingEmoji[joinPing!.payload.food ?? ""] ?? ""}. Want to join?
                  </p>
                  <p className="text-xs text-soft">
                    {joinPing!.payload.area} · {toneLabel((joinPing!.payload.tone ?? "random") as MockUser["tone"])} · matches your saved interests
                  </p>
                </div>
                <div className="flex gap-2">
                  <GradientButton size="sm" variant="ghost" onClick={() => markRead([joinPing!.id])}>Decline</GradientButton>
                  <GradientButton
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await acceptJoinAndGo(joinPing!, router, markRead);
                      setBusy(false);
                    }}
                  >
                    {busy ? "Joining…" : "Accept"}
                  </GradientButton>
                </div>
              </>
            )}
          </motion.div>
        )}
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
              {limit === "unlimited" ? "Unlimited matches" : `${Math.max(0, limit - used)} of ${limit} matches left today`}
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
                  <button type="button" className="flex items-center gap-1 hover:text-cream" onClick={cancelRequest}>
                    <X className="size-3.5" aria-hidden /> Cancel request
                  </button>
                </div>

                {(phase.kind === "live" ? phase.matches : phase.matches).map(({ user, score, distanceKm, requestId }, i) => (
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
                      <GradientButton size="sm" disabled={busy} onClick={() => startMatch(user, craving, requestId)}>Match</GradientButton>
                    </motion.div>
                  ))}

                {phase.kind === "pinged" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                      <p className="flex items-center gap-2 font-semibold"><Send className="size-4 text-peach" aria-hidden /> It is quiet right now</p>
                      <p className="mt-1 text-soft">
                        We sent &quot;Someone nearby wants {craving}. Want to join?&quot; to {phase.count} {phase.count === 1 ? "person" : "people"} who saved {craving} as a favourite.
                        Pings respect their notification settings and daily limits.
                      </p>
                    </div>
                    {phase.acceptedBy ? (
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4 rounded-2xl bg-peach/10 p-4 ring-1 ring-peach/40">
                        <div className="size-12 shrink-0 overflow-hidden rounded-full"><LayeredAvatar config={phase.acceptedBy.avatar} /></div>
                        <p className="flex-1 text-sm"><strong>{phase.acceptedBy.name}</strong> accepted your request!</p>
                        <GradientButton size="sm" onClick={() => startMatch(phase.acceptedBy!, craving)}>Continue</GradientButton>
                      </motion.div>
                    ) : ready ? (
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4 rounded-2xl bg-peach/10 p-4 ring-1 ring-peach/40">
                        <p className="flex-1 text-sm"><strong>Someone</strong> accepted your request!</p>
                        <GradientButton size="sm" onClick={openReady}>Continue</GradientButton>
                      </motion.div>
                    ) : phase.count ? (
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
