"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Flag, Loader2, Star, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { Chip } from "@/components/glass/chip";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { ReportDialog } from "@/components/safety/report-dialog";
import { AddStoryButton } from "@/components/stories/add-story-button";
import { Textarea } from "@/components/ui/textarea";
import { sendConnection, setFollow } from "@/lib/actions/account";
import { submitFeedback } from "@/lib/actions/meeting";
import { getStoryConsent, requestStoryConsent } from "@/lib/actions/stories";
import { syncBackend } from "@/lib/db/remote";
import { updateSession, useSession } from "@/lib/mock/session";
import type { MockUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const POSITIVE = ["Respectful", "Fun", "On time", "Great listener", "Good food tips"];
const NEGATIVE = ["Uncomfortable", "Rude", "Late", "Not as described"];

const feedbackSchema = z.object({
  rating: z.number().int().min(1, "Tap a star to rate").max(5),
  tags: z.array(z.string()).max(6),
  text: z.string().trim().max(500).optional(),
});

/** Required-but-skippable post-meeting screen. Live ratings are saved and update the partner's trust score. */
export function FeedbackForm({
  meetingId,
  partner,
  food,
  live = false,
}: {
  meetingId: string;
  partner: MockUser;
  food: string;
  live?: boolean;
}) {
  const router = useRouter();
  const session = useSession();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [consent, setConsent] = useState<"none" | "asking" | "granted" | "declined">("none");
  const first = partner.name.split(" ")[0];
  const { notes } = useNotifications();
  const grantedNow = live && notes.some((n) => n.kind === "story_consent_granted" && n.payload.matchId === meetingId);
  const shownConsent = grantedNow ? "granted" : consent;

  useEffect(() => {
    if (!live) return;
    void getStoryConsent(meetingId).then((s) => {
      if (s !== "none") setConsent(s === "pending" ? "asking" : s);
    });
  }, [live, meetingId]);

  async function submit() {
    const parsed = feedbackSchema.safeParse({ rating, tags, text: text || undefined });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid feedback");
    if (live) {
      setSending(true);
      const res = await submitFeedback(meetingId, parsed.data);
      setSending(false);
      if (!res.ok) return setError(res.error);
    }
    updateSession((s) => ({
      feedback: [...s.feedback, { meetingId, partnerId: partner.id, ...parsed.data, createdAt: new Date().toISOString() }],
    }));
    setDone(true);
  }

  const following = session?.following.includes(partner.id);
  const connection = session?.connections[partner.id];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-full ring-2 ring-peach/50">
          <LayeredAvatar config={partner.avatar} title={partner.name} />
        </div>
        <div>
          <p className="text-xs tracking-[0.2em] text-peach uppercase">Meeting ended</p>
          <h1 className="text-2xl font-medium">How was {food} with {first}?</h1>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <GlassCard strong className="space-y-6 p-6">
              <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star className={cn("size-10", (hover || rating) >= n ? "fill-peach text-peach" : "text-white/25")} />
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Quick tags</p>
                <div className="flex flex-wrap gap-2">
                  {[...POSITIVE, ...NEGATIVE].map((t) => (
                    <Chip
                      key={t}
                      selected={tags.includes(t)}
                      onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
                      className={NEGATIVE.includes(t) && tags.includes(t) ? "bg-red-400 bg-none" : undefined}
                    >
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Anything to add? (optional, private)" className="min-h-24 rounded-xl" aria-label="Feedback" />
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setReportOpen(true)} className="flex items-center gap-1.5 text-sm text-red-300 hover:underline">
                  <Flag className="size-4" aria-hidden /> Report {first}
                </button>
                <div className="flex gap-2">
                  <GradientButton variant="ghost" onClick={() => setDone(true)}>Skip</GradientButton>
                  <GradientButton onClick={() => void submit()} disabled={sending}>
                    {sending ? "Saving…" : "Submit"}
                  </GradientButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div key="next" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <GlassCard className="space-y-4 p-6">
              <h2 className="text-lg font-medium">Keep the conversation going</h2>
              <div className="flex flex-wrap gap-2">
                <GradientButton
                  size="sm"
                  variant={following ? "glass" : "brand"}
                  onClick={() => {
                    updateSession((s) => ({ following: s.following.includes(partner.id) ? s.following : [...s.following, partner.id] }));
                    syncBackend(() => setFollow(partner.id, true));
                  }}
                >
                  {following ? <Check /> : <UserPlus />} {following ? "Following" : `Follow ${first}`}
                </GradientButton>
                <GradientButton
                  size="sm"
                  variant="glass"
                  disabled={!!connection}
                  onClick={() => {
                    updateSession((s) => ({ connections: { ...s.connections, [partner.id]: "pending-out" } }));
                    syncBackend(() => sendConnection(partner.id));
                    toast.success("Connection request sent");
                  }}
                >
                  <Users /> {connection ? "Request sent" : "Send connection request"}
                </GradientButton>
              </div>
            </GlassCard>

            <GlassCard className="space-y-3 p-6">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <Camera className="size-5 text-peach" aria-hidden /> Set story of conversation
              </h2>
              <p className="text-sm text-soft">Meetings only become stories when both of you agree. Nothing was recorded.</p>
              {shownConsent === "none" && (
                <GradientButton
                  size="sm"
                  variant="glass"
                  onClick={async () => {
                    if (!live) {
                      setConsent("asking");
                      setTimeout(() => setConsent("granted"), 1800);
                      return;
                    }
                    const res = await requestStoryConsent(meetingId);
                    if (!res.ok) return toast.error(res.error);
                    setConsent("asking");
                  }}
                >
                  Ask {first} for consent
                </GradientButton>
              )}
              {shownConsent === "asking" && (
                <p className="flex items-center gap-2 text-sm text-soft">
                  <Loader2 className="size-4 animate-spin text-peach" aria-hidden /> Waiting for {first} to agree…
                </p>
              )}
              {shownConsent === "declined" && <p className="text-sm text-soft">{first} chose not to share this meeting. That&apos;s okay.</p>}
              {shownConsent === "granted" && (
                <div className="flex items-center gap-4">
                  <AddStoryButton caption={`${food} with ${first}`} matchId={live ? meetingId : undefined} />
                  <p className="text-sm">
                    <Check className="mr-1 inline size-4 text-peach" aria-hidden />
                    {first} agreed. Pick a photo or a short clip from the meetup.
                  </p>
                </div>
              )}
            </GlassCard>

            <div className="flex gap-3">
              <GradientLink href="/dashboard" className="flex-1">Back to dashboard</GradientLink>
              <GradientButton variant="glass" onClick={() => router.push(`/profile/${partner.id}`)}>View profile</GradientButton>
            </div>
            <p className="text-center text-xs text-soft">
              This meeting counted toward your <Link href="/streak" className="text-peach underline">streak</Link>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="meeting" targetId={meetingId} targetName={partner.name} />
    </div>
  );
}
