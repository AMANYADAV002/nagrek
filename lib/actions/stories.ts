"use server";

import { z } from "zod";
import { blockedEitherWay, loadPeople } from "@/lib/people";
import { getCaller, getMember, startOfIndianDay, type Fail } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import type { AvatarConfig, Story } from "@/lib/types";

const BUCKET = "stories";
const SIGNED_URL_SECONDS = 60 * 60;
const MAX_STORIES_PER_DAY = 10;
const idSchema = z.uuid();

export interface LiveStoryGroup {
  userId: string;
  name: string;
  avatar: AvatarConfig;
  stories: Story[];
  isMine?: boolean;
}

const publishSchema = z.object({
  path: z.string().max(200),
  kind: z.enum(["image", "video"]),
  caption: z.string().trim().max(140).optional(),
  matchId: z.uuid().optional(),
});

/**
 * Registers a file the browser already uploaded to `stories/<user id>/…`. The bucket enforces
 * size and type; this checks ownership, the daily limit and, for meeting stories, the partner's consent.
 */
export async function publishStory(raw: unknown): Promise<{ ok: true } | Fail> {
  const parsed = publishSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid story" };
  const member = await getMember();
  if ("error" in member) return member;
  const { admin, userId } = member;
  if (rateLimited(`story:${userId}`, 5, 60_000)) return SLOW_DOWN;
  const { path, kind, caption, matchId } = parsed.data;

  const [folder, file, ...rest] = path.split("/");
  if (folder !== userId || !file || rest.length || !/^[a-z0-9-]+\.(jpg|jpeg|png|webp|mp4|webm|mov)$/.test(file)) {
    return { ok: false, error: "Invalid upload" };
  }
  const { data: found } = await admin.storage.from(BUCKET).list(userId, { search: file, limit: 1 });
  if (!found?.some((f) => f.name === file)) return { ok: false, error: "Upload not found. Try again." };

  const { count } = await admin
    .from("stories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfIndianDay());
  if ((count ?? 0) >= MAX_STORIES_PER_DAY) {
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: `You can post ${MAX_STORIES_PER_DAY} stories a day.` };
  }

  if (matchId) {
    const { data: consent } = await admin
      .from("story_consents")
      .select("status")
      .eq("match_id", matchId)
      .eq("requester_id", userId)
      .maybeSingle();
    if (consent?.status !== "granted") return { ok: false, error: "Your partner hasn't agreed to a story yet." };
  }

  const { error } = await admin.from("stories").insert({ user_id: userId, kind, storage_path: path, caption: caption ?? null, match_id: matchId ?? null });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Stories from the last 24 hours, minus blocked people, suspended people and stories you reported. */
export async function loadStories(): Promise<LiveStoryGroup[]> {
  const caller = await getCaller();
  if (!caller) return [];
  const { admin, userId } = caller;
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const [{ data: rows }, blocked, { data: reported }] = await Promise.all([
    admin
      .from("stories")
      .select("id, user_id, kind, storage_path, caption, created_at")
      .eq("hidden", false)
      .gte("created_at", since)
      .order("created_at")
      .limit(300),
    blockedEitherWay(userId),
    admin.from("reports").select("target_id").eq("reporter_id", userId).eq("target_type", "story"),
  ]);
  const hidden = new Set((reported ?? []).map((r) => r.target_id as string));
  const stories = (rows ?? []).filter((s) => !blocked.has(s.user_id) && !hidden.has(s.id));
  if (!stories.length) return [];

  const mineIds = stories.filter((s) => s.user_id === userId).map((s) => s.id);
  const [people, signed, { data: views }] = await Promise.all([
    loadPeople([...new Set(stories.map((s) => s.user_id as string))]),
    admin.storage.from(BUCKET).createSignedUrls(stories.map((s) => s.storage_path as string), SIGNED_URL_SECONDS),
    mineIds.length
      ? admin.from("story_views").select("story_id").in("story_id", mineIds)
      : Promise.resolve({ data: [] as { story_id: string }[] }),
  ]);
  const urlOf = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const viewCount = new Map<string, number>();
  for (const v of views ?? []) viewCount.set(v.story_id, (viewCount.get(v.story_id) ?? 0) + 1);

  const groups = new Map<string, LiveStoryGroup>();
  for (const person of people) {
    groups.set(person.id, {
      userId: person.id,
      name: person.id === userId ? "Your story" : person.name,
      avatar: person.avatar,
      stories: [],
      isMine: person.id === userId,
    });
  }
  for (const s of stories) {
    const group = groups.get(s.user_id);
    const src = urlOf.get(s.storage_path);
    if (!group || !src) continue;
    group.stories.push({
      id: s.id,
      userId: s.user_id,
      kind: s.kind,
      src,
      caption: s.caption ?? undefined,
      createdAt: s.created_at,
      views: viewCount.get(s.id) ?? 0,
    });
  }
  const list = [...groups.values()].filter((g) => g.stories.length);
  return [...list.filter((g) => g.isMine), ...list.filter((g) => !g.isMine)];
}

export async function markStorySeen(storyId: string): Promise<void> {
  if (!idSchema.safeParse(storyId).success) return;
  const caller = await getCaller();
  if (!caller) return;
  await caller.supabase.from("story_views").upsert({ story_id: storyId, viewer_id: caller.userId }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true });
}

export async function deleteStory(storyId: string): Promise<{ ok: true } | Fail> {
  if (!idSchema.safeParse(storyId).success) return { ok: false, error: "Invalid story" };
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in first" };
  const { admin, userId } = caller;
  const { data: story } = await admin.from("stories").select("storage_path").eq("id", storyId).eq("user_id", userId).maybeSingle();
  if (!story) return { ok: false, error: "Story not found" };
  await admin.from("stories").delete().eq("id", storyId).eq("user_id", userId);
  await admin.storage.from(BUCKET).remove([story.storage_path]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Story consent: a meeting becomes a story only when the partner agrees.
// ---------------------------------------------------------------------------

async function meetingPartner(matchId: string) {
  if (!idSchema.safeParse(matchId).success) return null;
  const caller = await getCaller();
  if (!caller) return null;
  const { data: match } = await caller.admin.from("matches").select("user_a, user_b, status").eq("id", matchId).maybeSingle();
  if (!match || (match.user_a !== caller.userId && match.user_b !== caller.userId)) return null;
  if (match.status !== "ended" && match.status !== "live") return null;
  return { ...caller, partnerId: (match.user_a === caller.userId ? match.user_b : match.user_a) as string };
}

export type ConsentStatus = "none" | "pending" | "granted" | "declined";

export async function getStoryConsent(matchId: string): Promise<ConsentStatus> {
  const p = await meetingPartner(matchId);
  if (!p) return "none";
  const { data } = await p.admin.from("story_consents").select("status").eq("match_id", matchId).eq("requester_id", p.userId).maybeSingle();
  return (data?.status as ConsentStatus) ?? "none";
}

export async function requestStoryConsent(matchId: string): Promise<{ ok: true } | Fail> {
  const p = await meetingPartner(matchId);
  if (!p) return { ok: false, error: "Meeting not found" };
  const { admin, userId, partnerId } = p;
  if (rateLimited(`consent:${userId}`, 10, 60_000)) return SLOW_DOWN;
  const { data: existing } = await admin.from("story_consents").select("status").eq("match_id", matchId).eq("requester_id", userId).maybeSingle();
  if (existing) return existing.status === "declined" ? { ok: false, error: "They chose not to share this meeting." } : { ok: true };
  const { error } = await admin.from("story_consents").insert({ match_id: matchId, requester_id: userId, partner_id: partnerId });
  if (error) return { ok: false, error: error.message };
  const { data: me } = await admin.from("profiles").select("name").eq("id", userId).single();
  await admin.from("notifications").insert({
    user_id: partnerId,
    kind: "story_consent_request",
    payload: { matchId, from: userId, name: me?.name ?? "Someone" },
  });
  return { ok: true };
}

export async function respondStoryConsent(matchId: string, requesterId: string, agree: boolean): Promise<{ ok: true } | Fail> {
  if (!idSchema.safeParse(requesterId).success) return { ok: false, error: "Invalid request" };
  const p = await meetingPartner(matchId);
  if (!p || p.partnerId !== requesterId) return { ok: false, error: "Meeting not found" };
  const { admin, userId } = p;
  const { data, error } = await admin
    .from("story_consents")
    .update({ status: agree ? "granted" : "declined", decided_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .eq("requester_id", requesterId)
    .eq("partner_id", userId)
    .eq("status", "pending")
    .select("match_id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Already answered" };
  if (agree) {
    const { data: me } = await admin.from("profiles").select("name").eq("id", userId).single();
    await admin.from("notifications").insert({
      user_id: requesterId,
      kind: "story_consent_granted",
      payload: { matchId, from: userId, name: me?.name ?? "Someone" },
    });
  }
  return { ok: true };
}
