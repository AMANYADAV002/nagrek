"use server";

import { z } from "zod";
import { getCaller, startOfIndianDay, type Fail } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { loadStreakEvents, recordMeetingStreak } from "@/lib/streak/server";
import type { StreakEvent } from "@/lib/streak/calc";

/** Calls shorter than this do not count toward streaks. */
const MIN_MEETING_SECONDS = 60;
const MAX_REPORTS_PER_DAY = 10;
const idSchema = z.uuid();

async function participant(matchId: string) {
  if (!idSchema.safeParse(matchId).success) return null;
  const caller = await getCaller();
  if (!caller) return null;
  const { data: match } = await caller.admin.from("matches").select("id, user_a, user_b, status").eq("id", matchId).maybeSingle();
  if (!match || (match.user_a !== caller.userId && match.user_b !== caller.userId)) return null;
  const partnerId = match.user_a === caller.userId ? match.user_b : match.user_a;
  return { ...caller, match, partnerId: partnerId as string };
}

/** First time the two browsers connect. */
export async function markMeetingStarted(matchId: string): Promise<void> {
  const p = await participant(matchId);
  if (!p || p.match.status !== "live") return;
  await p.admin.from("meetings").update({ started_at: new Date().toISOString() }).eq("match_id", matchId).is("started_at", null);
}

/** Either person hangs up. Counts toward both streaks if the call really happened. */
export async function endMeeting(matchId: string): Promise<{ ok: true; counted: boolean; streakEvents: StreakEvent[] } | Fail> {
  const p = await participant(matchId);
  if (!p) return { ok: false, error: "Meeting not found" };
  const { admin, match, userId } = p;

  const { data: meeting } = await admin.from("meetings").select("id, started_at, ended_at").eq("match_id", matchId).maybeSingle();
  if (match.status === "live") await admin.from("matches").update({ status: "ended" }).eq("id", matchId).eq("status", "live");
  if (!meeting) return { ok: true, counted: false, streakEvents: await loadStreakEvents(admin, userId) };

  const endedAt = meeting.ended_at ?? new Date().toISOString();
  if (!meeting.ended_at) await admin.from("meetings").update({ ended_at: endedAt }).eq("id", meeting.id).is("ended_at", null);

  const seconds = meeting.started_at ? (new Date(endedAt).getTime() - new Date(meeting.started_at).getTime()) / 1000 : 0;
  const counted = seconds >= MIN_MEETING_SECONDS;
  if (counted) await recordMeetingStreak(admin, [match.user_a, match.user_b], meeting.id);
  return { ok: true, counted, streakEvents: await loadStreakEvents(admin, userId) };
}

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(40)).max(6),
  text: z.string().trim().max(500).optional(),
});

/** Saves feedback once per meeting and recomputes the partner's trust score. */
export async function submitFeedback(matchId: string, raw: unknown): Promise<{ ok: true } | Fail> {
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback" };
  const p = await participant(matchId);
  if (!p) return { ok: false, error: "Meeting not found" };
  const { admin, userId, partnerId } = p;

  const { data: meeting } = await admin.from("meetings").select("id").eq("match_id", matchId).maybeSingle();
  if (!meeting) return { ok: false, error: "This meeting never started" };

  const { error } = await admin.from("feedback").upsert(
    {
      meeting_id: meeting.id,
      author_id: userId,
      partner_id: partnerId,
      rating: parsed.data.rating,
      tags: parsed.data.tags,
      body: parsed.data.text ?? null,
    },
    { onConflict: "meeting_id,author_id" },
  );
  if (error) return { ok: false, error: error.message };

  // Trust score: average of the last 50 ratings, pulled toward 5.0 by three virtual ratings
  // so one bad review cannot sink a new member.
  const { data: ratings } = await admin
    .from("feedback")
    .select("rating")
    .eq("partner_id", partnerId)
    .not("rating", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  const list = (ratings ?? []).map((r) => r.rating as number);
  const score = (list.reduce((a, b) => a + b, 0) + 3 * 5) / (list.length + 3);
  await admin.from("profiles").update({ trust_score: Math.round(score * 100) / 100 }).eq("id", partnerId);
  return { ok: true };
}

const reportSchema = z.object({
  targetType: z.enum(["user", "story", "meeting"]),
  targetId: z.string().min(1).max(64),
  reason: z.string().min(2).max(80),
  details: z.string().trim().max(500).optional(),
});

/** Confidential report. Rate-limited per reporter per day. */
export async function fileReport(raw: unknown): Promise<{ ok: true } | Fail> {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid report" };
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in to report" };
  const { admin, userId } = caller;
  if (rateLimited(`report:${userId}`, 3, 60_000)) return SLOW_DOWN;

  const { count } = await admin
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("reporter_id", userId)
    .gte("created_at", startOfIndianDay());
  if ((count ?? 0) >= MAX_REPORTS_PER_DAY) return { ok: false, error: "You've sent a lot of reports today. Our team is reviewing them." };

  const { error } = await admin.from("reports").insert({
    reporter_id: userId,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
