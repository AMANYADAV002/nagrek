"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Clock, Flame, MapPin, Radar, Search, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { Chip } from "@/components/glass/chip";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { Eyebrow } from "@/components/glass/section-heading";
import { StoriesRow } from "@/components/stories/stories-row";
import { CravingInviteBanner } from "@/components/history/craving-invite-banner";
import { acceptJoinAndGo } from "@/components/notifications/notification-bell";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { MatchDeck } from "@/components/matching/match-deck";
import { SectionBoundary } from "@/components/section-boundary";
import { clearMatchQueue, matchQueueSnapshot, parseMatchQueue, saveMatchQueue, subscribeMatchQueue, type DeckCard } from "@/lib/matching/deck-queue";
import { cancelCraving, getMatchQuota, postCraving, proposeMatch, type Quota } from "@/lib/actions/matching";
import { getPlan } from "@/lib/config/plans";
import { cravingEmoji, cuisineChips } from "@/lib/data/cravings";
import { track } from "@/lib/analytics";
import { toneLabel, uid } from "@/lib/format";
import {
  findLiveMatches, joinPingCandidates, LOW_TRAFFIC_THRESHOLD, REQUEST_TTL_MS,
} from "@/lib/matching/live";
import { useDraft } from "@/lib/draft";
import { useSession } from "@/lib/mock/session";
import { getMockUser } from "@/lib/mock/users";
import { useLocalWeather } from "@/components/streak/use-local-weather";
import { WeatherBackdrop } from "@/components/streak/weather-backdrop";
import { calculateStreak } from "@/lib/streak/calc";
import { backendEnabled } from "@/lib/supabase/env";
import type { MockUser } from "@/lib/types";

type LiveMatch = { user: MockUser; score: number; distanceKm?: number; requestId?: string };

function ExpiryClock({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  useEffect(() => {
    let fired = false;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (!fired && n >= deadline) {
        fired = true;
        onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline]);
  const remaining = Math.max(0, deadline - now);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  return (
    <span className="flex items-center gap-1.5">
      <Clock className="size-3.5 text-peach" aria-hidden /> Request expires in {mm}:{ss}
    </span>
  );
}

function matchNote(via: "craving" | "saved" | "category" | null, food: string): string | null {
  if (via === "saved") return `Nobody is craving ${food} right now. These people saved it, and the match still follows your diet.`;
  if (via === "category") return `No exact dish matched, so this is the same kind of food as ${food}. Veg, non-veg, halal and jain stay separate.`;
  return null;
}

type Phase =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "live"; matches: LiveMatch[]; expiresAt: number; note: string | null }
  | { kind: "pinged"; pinged: MockUser[]; count: number; matches: LiveMatch[]; expiresAt: number; acceptedBy?: MockUser; note: string | null };

export function DashboardView() {
  const router = useRouter();
  const session = useSession();
  const live = backendEnabled();
  const { notes, markRead } = useNotifications();
  const [craving, setCraving] = useDraft("dashboard-craving", "");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [incoming, setIncoming] = useState<{ user: MockUser; food: string } | null>(null);
  const [matchesToday, setMatchesToday] = useState(1);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busy, setBusy] = useState(false);
  const [kycLocked, setKycLocked] = useState(false);
  const [deckStart, setDeckStart] = useState(0);

  const prefs = session?.preferences;
  const weather = useLocalWeather(prefs?.location.city, prefs?.location.point?.lat, prefs?.location.point?.lng);
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
  const ready = live ? notes.find((n) => (n.kind === "join_accepted" || n.kind === "match" || n.kind === "match_accepted") && !n.read_at) : undefined;

  useEffect(() => {
    if (live) void getMatchQuota().then(setQuota);
  }, [live]);

  useEffect(() => {
    if (!live) return;
    fetch("/api/kyc/status")
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { required?: boolean; status?: string };
        setKycLocked(Boolean(json.required) && json.status !== "verified");
      })
      .catch(() => {});
  }, [live]);

  const queueRaw = useSyncExternalStore(subscribeMatchQueue, matchQueueSnapshot, () => "");
  const [queueSeen, setQueueSeen] = useState("");
  if (queueRaw !== queueSeen) {
    setQueueSeen(queueRaw);
    const saved = parseMatchQueue(queueRaw);
    if (saved) {
      setCraving(saved.food);
      setDeckStart(saved.index);
      if (saved.kind === "live") setPhase({ kind: "live", matches: saved.cards, expiresAt: saved.expiresAt, note: saved.note });
      else setPhase({ kind: "pinged", pinged: [], count: saved.pinged, matches: saved.cards, expiresAt: saved.expiresAt, note: saved.note });
    }
  }

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

  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  const expireRequest = useCallback(() => {
    clearMatchQueue();
    setPhase({ kind: "idle" });
    toast.message("Your request expired. Post a new craving anytime.");
  }, []);

  if (!session || !prefs) return null;
  const myPrefs = prefs;

  async function search() {
    if (kycLocked) return toast.error("Verify your identity before matching.");
    if (!craving) return toast.error("Pick what you are craving first.");
    if (limit !== "unlimited" && used >= limit) return toast.error(`You have used all ${limit} matches today. Upgrade for more.`);
    clearMatchQueue();
    setDeckStart(0);
    setPhase({ kind: "searching" });

    if (live) {
      const [res] = await Promise.all([postCraving(craving), new Promise((r) => setTimeout(r, 1200))]);
      if (!res.ok) {
        setPhase({ kind: "idle" });
        return toast.error(res.error);
      }
      setQuota(res.quota);
      const expiresAt = new Date(res.expiresAt).getTime();
      const matches = res.matches.map((c) => ({ user: c.person, score: c.score, distanceKm: c.distanceKm, requestId: c.requestId }));
      track("craving", { food: craving, live: matches.length, pinged: res.pinged });
      const note = matchNote(res.via, craving);
      if (matches.length >= LOW_TRAFFIC_THRESHOLD) setPhase({ kind: "live", matches, expiresAt, note });
      else setPhase({ kind: "pinged", pinged: [], count: res.pinged, matches, expiresAt, note });
      return;
    }

    await new Promise((r) => setTimeout(r, 2200));
    const found = findLiveMatches(myPrefs, craving, excluded);
    const expires = Date.now() + REQUEST_TTL_MS;
    if (found.length >= LOW_TRAFFIC_THRESHOLD) {
      setPhase({ kind: "live", matches: found, expiresAt: expires, note: null });
      return;
    }
    const pinged = joinPingCandidates(myPrefs, craving, excluded);
    const pool = pinged.length ? pinged : found.map((l) => l.user);
    setPhase({ kind: "pinged", pinged: pool, count: pool.length, matches: [], expiresAt: expires, note: null });
    if (pool.length) {
      setTimeout(() => {
        if (!alive.current) return;
        setPhase((p) => (p.kind === "pinged" ? { ...p, acceptedBy: pool[0] } : p));
        toast.success(`${pool[0].name.split(" ")[0]} wants to join you for ${craving}!`);
      }, 3500);
    }
  }

  async function startMatch(user: MockUser, food: string, requestId?: string): Promise<{ ok: true; status: "pending" } | { ok: false; error: string }> {
    track("match", { food, with: user.id });
    if (live && requestId) {
      setBusy(true);
      const res = await proposeMatch(requestId);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return res;
      }
      clearMatchQueue();
      router.push(`/match/${res.matchId}/pre`);
      return { ok: true, status: "pending" };
    }
    setMatchesToday((n) => n + 1);
    clearMatchQueue();
    router.push(`/match/${uid("m")}/pre?with=${user.id}&food=${encodeURIComponent(food)}`);
    return { ok: true, status: "pending" };
  }

  function openProfile(card: DeckCard, index: number) {
    if (phase.kind !== "live" && phase.kind !== "pinged") return;
    saveMatchQueue({
      index,
      food: craving,
      cards: phase.matches,
      expiresAt: phase.expiresAt,
      note: phase.note,
      kind: phase.kind,
      pinged: phase.kind === "pinged" ? phase.count : 0,
    });
    router.push(`/profile/${card.user.id}?from=match`);
  }

  function openReady() {
    if (!ready) return;
    markRead([ready.id]);
    router.push(`/match/${ready.payload.matchId}/pre`);
  }

  function cancelRequest() {
    clearMatchQueue();
    setPhase({ kind: "idle" });
    if (live) void cancelCraving();
  }

  const streak = calculateStreak(session.streakEvents);
  const chips = [...new Set([...myPrefs.foodInterests, ...cuisineChips])].slice(0, 14);

  return (
    <div className="space-y-6">
      <CravingInviteBanner />
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
                  {ready.kind === "match" ? "Someone matched with your" : "Someone accepted your"} {ready.payload.food}{" "}
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

      <div className={(phase.kind === "live" || phase.kind === "pinged") && phase.matches.length > 0 ? "grid gap-6" : "grid gap-6 lg:grid-cols-[1.6fr_1fr]"}>
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

          {kycLocked ? (
            <div className="relative mt-6 space-y-4">
              <p className="text-sm text-soft">Verify your identity before you post a craving. DigiLocker checks that you are 18 or older.</p>
              <GradientLink href="/verify-kyc" size="lg">Verify Identity with DigiLocker</GradientLink>
            </div>
          ) : null}
          {!kycLocked && <AnimatePresence mode="wait">
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
                {phase.note && <p className="text-sm text-soft">{phase.note}</p>}
                <div className="flex items-center justify-between text-xs text-soft">
                  <ExpiryClock deadline={phase.expiresAt} onExpire={expireRequest} />
                  <button type="button" className="flex items-center gap-1 hover:text-cream" onClick={cancelRequest}>
                    <X className="size-3.5" aria-hidden /> Cancel request
                  </button>
                </div>

                {phase.matches.length > 0 && (
                  <SectionBoundary>
                  <MatchDeck
                    key={phase.expiresAt}
                    cards={phase.matches}
                    food={craving}
                    initialIndex={deckStart}
                    onAccept={(card) => startMatch(card.user, craving, card.requestId)}
                    onOpenProfile={openProfile}
                    onDone={() => {
                      clearMatchQueue();
                      setPhase({ kind: "idle" });
                    }}
                  />
                  </SectionBoundary>
                )}

                {phase.kind === "pinged" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                      <p className="flex items-center gap-2 font-semibold"><Send className="size-4 text-peach" aria-hidden /> It is quiet right now</p>
                      <p className="mt-1 text-soft">
                        We asked {phase.count} {phase.count === 1 ? "person" : "people"} who fit this craving and your diet if they want to join.
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
          </AnimatePresence>}
        </GlassCard>

        <div className="space-y-6">
          <Link href="/streak" className="relative block overflow-hidden rounded-2xl border border-white/15" aria-label={`${streak}-day streak, ${weather.place}, ${weather.label}`}>
            <WeatherBackdrop scene={weather.scene} />
            <div className="relative z-10 flex items-center gap-4 bg-ink/55 p-5 text-cream backdrop-blur-md transition-colors hover:bg-ink/45">
              <span className="text-4xl animate-flicker" aria-hidden>🔥</span>
              <div className="flex-1">
                <p className="font-heading text-2xl">{streak}-day streak</p>
                <p className="text-xs text-cream/75">Keep meeting to unlock sponsor rewards</p>
                <p className="text-[11px] text-cream/70">{weather.place} · {weather.label}</p>
              </div>
              <Flame className="size-5 text-peach" aria-hidden />
            </div>
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
