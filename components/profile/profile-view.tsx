"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Ban, Bell, Check, Crown, Flag, Flame, MapPin, Pencil, ShieldCheck, Star, Trash2, UserPlus, Users, VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { StoryRing } from "@/components/avatar/story-ring";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { StoriesRow } from "@/components/stories/stories-row";
import { StoryViewer } from "@/components/story-viewer/story-viewer";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatInr, getPlan } from "@/lib/config/plans";
import { cravingEmoji } from "@/lib/data/cravings";
import { toneLabel } from "@/lib/format";
import { updateSession, useSession, type SessionState } from "@/lib/mock/session";
import { deleteAccount, saveProfile, sendConnection, setBlock, setFollow, setMute } from "@/lib/actions/account";
import { signOutEverywhere, syncBackend } from "@/lib/db/remote";
import { isUuid } from "@/lib/db/map";
import { daysLeft } from "@/lib/payments/plan-status";
import { backendEnabled } from "@/lib/supabase/env";
import { groupSeen, storyHandlers, useStoryGroups } from "@/lib/stories";
import { calculateStreak } from "@/lib/streak/calc";
import type { MockUser, PlanId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DisplayProfile {
  id: string;
  name: string;
  handle: string;
  bio: string;
  city: string;
  area?: string;
  foods: string[];
  tone: string;
  trustScore: number | null;
  streak: number;
  planId: PlanId | null;
  avatar: MockUser["avatar"];
  followers: number;
  following: number;
  connections: number;
}

function fromSession(s: SessionState): DisplayProfile {
  const avgRating = s.feedback.length ? s.feedback.reduce((a, f) => a + f.rating, 0) / s.feedback.length : null;
  return {
    id: "me",
    name: s.user?.name ?? "You",
    handle: s.user?.handle ?? "you",
    bio: s.bio,
    city: s.preferences?.location.city ?? "",
    area: s.preferences?.location.area,
    foods: s.preferences?.foodInterests ?? [],
    tone: s.preferences?.tone ?? "random",
    trustScore: avgRating,
    streak: calculateStreak(s.streakEvents),
    planId: s.plan,
    avatar: s.avatar,
    followers: s.followers ?? 0,
    following: s.following.length,
    connections: Object.values(s.connections).filter((c) => c === "accepted").length,
  };
}

function fromUser(u: MockUser, s: SessionState): DisplayProfile {
  return {
    id: u.id, name: u.name, handle: u.handle, bio: u.bio, city: u.city, area: u.area, foods: u.foodInterests,
    // Real people's plans are private; only demo people show a badge.
    tone: u.tone, trustScore: u.trustScore, streak: u.streak, planId: isUuid(u.id) ? null : u.plan, avatar: u.avatar,
    followers: u.followers + (s.following.includes(u.id) ? 1 : 0), following: u.following, connections: u.connections,
  };
}

export function ProfileView({ user }: { user?: MockUser }) {
  const session = useSession();
  const router = useRouter();
  const [viewer, setViewer] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const allGroups = useStoryGroups(session);
  const [handlers] = useState(storyHandlers);

  if (!session) return null;
  const isMe = !user;
  const p = isMe ? fromSession(session) : fromUser(user, session);
  const plan = getPlan(p.planId);
  const groups = allGroups.filter((g) => (isMe ? g.isMine : g.userId === p.id));
  const ringState = groups.length ? (groupSeen(groups[0], session.seenStories) ? "seen" : "unseen") : "none";
  const following = !isMe && session.following.includes(p.id);
  const connection = !isMe ? session.connections[p.id] : undefined;
  const blocked = !isMe && session.blocked.includes(p.id);
  const muted = !isMe && session.muted.includes(p.id);

  if (blocked) {
    return (
      <GlassCard className="space-y-4 p-10 text-center">
        <Ban className="mx-auto size-10 text-peach" aria-hidden />
        <h1 className="text-2xl font-medium">You blocked {p.name}</h1>
        <p className="text-sm text-soft">You will not see each other anywhere on Nagrek.</p>
        <GradientButton
          variant="outline"
          onClick={() => {
            updateSession((s) => ({ blocked: s.blocked.filter((x) => x !== p.id) }));
            syncBackend(() => setBlock(p.id, false));
          }}
        >
          Unblock
        </GradientButton>
      </GlassCard>
    );
  }

  const stats = [
    { label: "Followers", value: p.followers },
    { label: "Following", value: p.following },
    { label: "Connections", value: p.connections },
  ];

  return (
    <div className="space-y-6">
      <GlassCard className="relative overflow-hidden p-6 md:p-9">
        <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(ellipse,#ff7e5f33,transparent_70%)]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
            <StoryRing
              avatar={p.avatar}
              name={p.name}
              size={128}
              state={ringState}
              onClick={groups.length ? () => setViewer(true) : isMe ? () => router.push("/avatar") : undefined}
              label={groups.length ? `View ${p.name}'s stories` : "Edit avatar"}
            />
          </motion.div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-medium">{p.name}</h1>
              {plan && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-ink">
                  <Crown className="size-3" aria-hidden /> {plan.name}
                </span>
              )}
            </div>
            <p className="text-sm text-soft">@{p.handle}</p>
            {isMe && editing ? (
              <div className="space-y-2">
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} className="rounded-xl" aria-label="Bio" />
                <div className="flex gap-2">
                  <GradientButton
                    size="sm"
                    onClick={() => {
                      updateSession({ bio: bio.trim() });
                      syncBackend(() => saveProfile({ bio: bio.trim() }));
                      setEditing(false);
                      toast.success("Bio updated");
                    }}
                  >
                    Save
                  </GradientButton>
                  <GradientButton size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</GradientButton>
                </div>
              </div>
            ) : (
              <p className="max-w-lg text-sm leading-relaxed">
                {p.bio || (isMe ? <span className="text-soft">Add a short bio so matches know what to talk about.</span> : null)}
                {isMe && (
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center gap-1 text-xs text-peach hover:underline"
                    onClick={() => {
                      setBio(session.bio);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="size-3" aria-hidden /> Edit
                  </button>
                )}
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-soft">
              {p.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-peach" aria-hidden /> {p.area ? `${p.area}, ` : ""}
                  {p.city} (approx.)
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Star className="size-3.5 text-peach" aria-hidden /> Trust {p.trustScore ? p.trustScore.toFixed(1) : "new"}
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="size-3.5 text-peach" aria-hidden /> {p.streak}-day streak
              </span>
              <span>{toneLabel(p.tone)}</span>
            </div>
          </div>
          <div className="flex gap-6 md:flex-col md:gap-3 md:text-right">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-heading text-2xl">{s.value}</p>
                <p className="text-[11px] text-soft">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {!isMe && (
          <div className="relative mt-6 flex flex-wrap gap-2">
            <GradientButton
              size="sm"
              variant={following ? "glass" : "brand"}
              onClick={() => {
                updateSession((s) => ({
                  following: following ? s.following.filter((x) => x !== p.id) : [...s.following, p.id],
                }));
                syncBackend(() => setFollow(p.id, !following));
              }}
            >
              {following ? <Check /> : <UserPlus />} {following ? "Following" : "Follow"}
            </GradientButton>
            <GradientButton
              size="sm"
              variant="glass"
              disabled={!!connection}
              onClick={() => {
                updateSession((s) => ({ connections: { ...s.connections, [p.id]: "pending-out" } }));
                syncBackend(() => sendConnection(p.id));
                toast.success(`Connection request sent to ${p.name}`);
              }}
            >
              <Users />
              {connection === "accepted" ? "Connected" : connection === "pending-out" ? "Request sent" : connection === "pending-in" ? "Wants to connect" : "Connect"}
            </GradientButton>
            <GradientButton
              size="sm"
              variant="ghost"
              onClick={() => {
                updateSession((s) => ({ muted: muted ? s.muted.filter((x) => x !== p.id) : [...s.muted, p.id] }));
                syncBackend(() => setMute(p.id, !muted));
              }}
            >
              <VolumeX /> {muted ? "Unmute" : "Mute"}
            </GradientButton>
            <GradientButton
              size="sm"
              variant="ghost"
              onClick={() => {
                updateSession((s) => ({ blocked: [...s.blocked, p.id], following: s.following.filter((x) => x !== p.id) }));
                syncBackend(() => setBlock(p.id, true));
                toast(`${p.name} is blocked`);
              }}
            >
              <Ban /> Block
            </GradientButton>
            <GradientButton size="sm" variant="ghost" onClick={() => setReportOpen(true)}>
              <Flag /> Report
            </GradientButton>
          </div>
        )}
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <GlassCard className="p-6">
            <h2 className="mb-4 text-lg font-medium">Stories</h2>
            {isMe ? <StoriesRow /> : groups.length ? <StoriesRow onlyUserId={p.id} /> : <p className="text-sm text-soft">No stories in the last 24 hours.</p>}
          </GlassCard>
          <GlassCard className="p-6">
            <h2 className="mb-4 text-lg font-medium">Food interests</h2>
            <div className="flex flex-wrap gap-2">
              {p.foods.map((f) => (
                <span key={f} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm">
                  {cravingEmoji[f] ?? "🍽️"} {f}
                </span>
              ))}
            </div>
          </GlassCard>
        </div>

        {isMe ? (
          <div className="space-y-6">
            <GlassCard className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-medium">Your plan</h2>
                  <p className="text-sm text-soft">
                    {plan ? `${plan.name} · ${formatInr(plan.priceInr)} per 30 days · active` : "No active plan"}
                  </p>
                  {session.planSince && <p className="mt-1 text-xs text-soft">Since {new Date(session.planSince).toLocaleDateString("en-IN")}</p>}
                  {session.planExpiresAt && (
                    <p className="mt-1 text-xs text-soft">
                      Active until {new Date(session.planExpiresAt).toLocaleDateString("en-IN")} · {daysLeft(session.planExpiresAt)} days left. No auto-renewal.
                    </p>
                  )}
                </div>
                <ShieldCheck className="size-5 text-peach" aria-hidden />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <GradientLink href="/plans" size="sm" variant="glass">Extend or change plan</GradientLink>
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">Wish list</h2>
                <Link href="/wishlist" className="text-xs text-peach hover:underline">See all</Link>
              </div>
              <ul className="space-y-2 text-sm">
                {session.wishlist.slice(0, 3).map((w) => (
                  <li key={w.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="size-1.5 rounded-full bg-peach" /> {w.title}
                  </li>
                ))}
                {!session.wishlist.length && <li className="text-soft">Nothing yet.</li>}
              </ul>
            </GlassCard>
            <GlassCard className="space-y-4 p-6">
              <h2 className="text-lg font-medium">Settings</h2>
              <label className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <Bell className="size-4 text-peach" aria-hidden /> &quot;Request to join&quot; notifications
                </span>
                <Switch
                  checked={session.notificationsEnabled}
                  onCheckedChange={(c) => {
                    updateSession({ notificationsEnabled: c });
                    syncBackend(() => saveProfile({ notificationsEnabled: c }));
                  }}
                />
              </label>
              <Link href="/avatar" className="block text-sm text-peach hover:underline">Edit avatar</Link>
              <div className={cn("rounded-2xl border p-4", confirmDelete ? "border-red-400/40 bg-red-500/10" : "border-white/10")}>
                {confirmDelete ? (
                  <div className="space-y-3">
                    <p className="text-sm">This permanently deletes your account, preferences, stories and history.</p>
                    <div className="flex gap-2">
                      <GradientButton
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          if (backendEnabled()) {
                            const result = await deleteAccount();
                            if (!result.ok) return toast.error(result.error ?? "Could not delete the account");
                          }
                          await signOutEverywhere();
                        }}
                      >
                        Yes, delete everything
                      </GradientButton>
                      <GradientButton size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep my account</GradientButton>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-sm text-red-300 hover:underline">
                    <Trash2 className="size-4" aria-hidden /> Delete my account and data
                  </button>
                )}
              </div>
            </GlassCard>
          </div>
        ) : (
          <GlassCard className="h-fit space-y-3 p-6">
            <h2 className="text-lg font-medium">Plan a meal together</h2>
            <p className="text-sm text-soft">
              {connection === "accepted" ? "You are connected — propose something from your wish list." : "Connect first to plan a future meetup."}
            </p>
            <GradientLink href="/wishlist" size="sm" variant={connection === "accepted" ? "brand" : "glass"}>
              Open wish list
            </GradientLink>
          </GlassCard>
        )}
      </div>

      {viewer && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          onClose={() => setViewer(false)}
          onSeen={handlers.onSeen}
          onDelete={handlers.onDelete}
        />
      )}
      {!isMe && (
        <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={p.id} targetName={p.name} />
      )}
    </div>
  );
}
