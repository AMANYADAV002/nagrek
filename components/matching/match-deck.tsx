"use client";

import { useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GradientButton } from "@/components/glass/gradient-button";
import { swipeDecision, type DeckCard } from "@/lib/matching/deck-queue";
import { dietaryLabel, toneLabel } from "@/lib/format";

export type { DeckCard };

type Ask = "idle" | "sending" | "pending" | "accepted" | "rejected" | "error";

const askLabel: Record<Ask, string> = {
  idle: "Accept",
  sending: "Sending request…",
  pending: "Request pending",
  accepted: "Accepted",
  rejected: "Request declined",
  error: "Try again",
};

/** One candidate at a time, about a quarter of a desktop screen. Drag either way to skip. Accept sends the meeting request. */
export function MatchDeck({
  cards,
  food,
  initialIndex = 0,
  onAccept,
  onDone,
  onOpenProfile,
}: {
  cards: DeckCard[];
  food: string;
  initialIndex?: number;
  onAccept: (card: DeckCard) => Promise<{ ok: true; status: "pending" | "accepted" | "rejected" } | { ok: false; error: string }>;
  onDone: () => void;
  onOpenProfile: (card: DeckCard, index: number) => void;
}) {
  const [index, setIndex] = useState(() => Math.min(initialIndex, Math.max(0, cards.length - 1)));
  const [ask, setAsk] = useState<Ask>("idle");
  const [askError, setAskError] = useState("");
  const reduce = useReducedMotion();
  const flying = useRef(false);
  const dragged = useRef(0);
  const card = cards[index];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-8, 8]);
  const skipRight = useTransform(x, [24, 140], [0, 1]);
  const skipLeft = useTransform(x, [-140, -24], [1, 0]);

  async function skip(dir: "left" | "right") {
    if (!card || flying.current || ask === "sending") return;
    flying.current = true;
    if (!reduce) await animate(x, dir === "left" ? -640 : 640, { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
    const next = index + 1;
    if (next >= cards.length) onDone();
    else {
      setIndex(next);
      setAsk("idle");
      setAskError("");
    }
    x.set(0);
    flying.current = false;
  }

  async function accept() {
    if (!card || ask === "sending" || ask === "pending" || ask === "accepted" || flying.current) return;
    setAsk("sending");
    setAskError("");
    const res = await onAccept(card);
    if (!res.ok) {
      setAsk("error");
      setAskError(res.error);
      return;
    }
    setAsk(res.status);
  }

  if (!card) {
    return (
      <p className="py-10 text-center text-sm text-soft" role="status">
        No more profiles for {food}. Try another craving.
      </p>
    );
  }

  const place = card.distanceKm !== undefined ? `About ${Math.max(1, Math.round(card.distanceKm))} km away` : [card.user.area, card.user.city].filter(Boolean).join(", ");
  const next = cards[index + 1];

  function openProfile() {
    if (dragged.current > 12) {
      dragged.current = 0;
      return;
    }
    onOpenProfile(card, index);
  }

  return (
    <section
      tabIndex={0}
      className="mx-auto w-full max-w-md rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-peach lg:h-[50vh] lg:min-h-[26rem] lg:w-[50vw] lg:max-w-none"
      aria-label={`Matches for ${food}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") void skip("left");
        if (e.key === "ArrowRight") void skip("right");
      }}
    >
      <p className="mb-3 text-center text-xs tracking-[0.16em] text-soft uppercase">
        {index + 1} of {cards.length} · swipe either way to skip
      </p>
      <div className="relative h-[calc(100%-7.5rem)] min-h-80">
        {next && <div className="absolute inset-x-4 top-3 -z-10 h-[96%] rounded-[2rem] bg-white/[0.04] ring-1 ring-white/10" aria-hidden />}
        <motion.span style={{ opacity: skipLeft }} className="pointer-events-none absolute top-5 left-5 z-10 rounded-full bg-red-500/90 px-3 py-1 text-sm font-semibold text-white">
          Nope
        </motion.span>
        <motion.span style={{ opacity: skipRight }} className="pointer-events-none absolute top-5 right-5 z-10 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
          Skip
        </motion.span>
        <motion.article
          key={card.user.id}
          style={{ x, rotate }}
          drag={reduce ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDrag={(_, info) => {
            dragged.current = Math.abs(info.offset.x);
          }}
          onDragEnd={(_, info) => {
            const dir = swipeDecision(info.offset.x, info.velocity.x);
            if (dir) void skip(dir);
          }}
          className="glass flex h-full cursor-grab flex-col overflow-hidden rounded-[2rem] active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={openProfile}
            className="flex min-h-40 flex-1 items-center justify-center bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-peach"
            aria-label={`View ${card.user.name}'s profile`}
          >
            <span className="size-36 sm:size-44">
              <LayeredAvatar config={card.user.avatar} title={card.user.name} />
            </span>
          </button>
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-3xl font-medium">
                  {card.user.name}
                  {card.user.age ? <span className="text-soft">, {card.user.age}</span> : null}
                </h2>
                <p className="mt-1 text-sm text-soft">
                  {place} · {toneLabel(card.user.tone)} · ★ {card.user.trustScore}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-brand px-3 py-1 text-sm font-bold text-ink">{card.score}% match</span>
            </div>
            {card.user.bio && <p className="line-clamp-3 text-sm leading-relaxed">{card.user.bio}</p>}
            <p className="text-sm text-soft">
              Craving <strong className="text-cream">{food}</strong>
              <span className="mx-2 text-white/20">·</span>
              <strong className="text-cream">{dietaryLabel(card.user.dietary)}</strong>
            </p>
            <button type="button" onClick={openProfile} className="text-sm font-semibold text-peach underline-offset-4 hover:underline">
              View profile
            </button>
          </div>
        </motion.article>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => void skip("left")} className="grid size-12 shrink-0 place-items-center rounded-full border border-white/15 text-soft hover:text-cream" aria-label="Skip to the next profile">
          <ChevronLeft className="size-5" />
        </button>
        <GradientButton size="lg" className="h-14 flex-1 text-base" disabled={ask === "sending" || ask === "pending" || ask === "accepted"} onClick={() => void accept()}>
          <Check /> {askLabel[ask]}
        </GradientButton>
        <button type="button" onClick={() => void skip("right")} className="grid size-12 shrink-0 place-items-center rounded-full border border-white/15 text-soft hover:text-cream" aria-label="Pass to the next profile">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <p className="mt-2 min-h-5 text-center text-xs text-soft" role="status">
        {ask === "error" ? askError : ask === "pending" ? "Waiting for them to accept." : ask === "accepted" ? "You both accepted. Opening the call." : ask === "rejected" ? "They declined this one." : ""}
      </p>
    </section>
  );
}
