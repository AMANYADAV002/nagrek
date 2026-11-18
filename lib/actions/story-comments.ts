"use server";

import { z } from "zod";
import { allowedMediaUrl, isEmojiMessage } from "@/lib/chat/media";
import { blockedEitherWay, loadPeople } from "@/lib/people";
import { getCaller, getMember, type Caller, type Fail } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { handlesIn } from "@/lib/stories/comment-text";
import type { AvatarConfig } from "@/lib/types";

const idSchema = z.uuid();
const textSchema = z.string().trim().min(1).max(500);
const PAGE = 30;
const SQL_HINT = "Run supabase/migrations/20261111210000_story_comments.sql in the Supabase SQL editor, then try again.";

export type CommentKind = "text" | "emoji" | "gif" | "sticker";

export interface StoryComment {
  id: string;
  storyId: string;
  authorId: string;
  name: string;
  handle: string;
  avatar: AvatarConfig;
  kind: CommentKind;
  body: string;
  at: string;
}

export interface CommentPage {
  comments: StoryComment[];
  count: number;
  older: string | null;
  mentions: Record<string, string>;
  warning: string;
}

interface CommentRow {
  id: string;
  story_id: string;
  author_id: string;
  kind: CommentKind;
  body: string;
  created_at: string;
}

function missingTable(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("does not exist") || message.includes("schema cache");
}

async function visibleStory(userId: string, storyId: string) {
  const caller = await getCaller();
  if (!caller) return null;
  const { data } = await caller.admin.from("stories").select("id, user_id, hidden, created_at").eq("id", storyId).maybeSingle();
  if (!data) return null;
  if (data.user_id === userId) return { caller, story: data };
  if (data.hidden) return null;
  if (Date.now() - new Date(data.created_at).getTime() > 24 * 3_600_000) return null;
  const blocked = await blockedEitherWay(userId);
  if (blocked.has(data.user_id)) return null;
  return { caller, story: data, blocked };
}

async function toComments(admin: Caller["admin"], rows: CommentRow[], blocked: Set<string>): Promise<{ comments: StoryComment[]; mentions: Record<string, string> }> {
  const visible = rows.filter((row) => !blocked.has(row.author_id));
  const people = await loadPeople(visible.map((row) => row.author_id));
  const personOf = new Map(people.map((person) => [person.id, person]));
  const comments = visible.flatMap((row) => {
    const person = personOf.get(row.author_id);
    if (!person) return [];
    return [{
      id: row.id,
      storyId: row.story_id,
      authorId: row.author_id,
      name: person.name,
      handle: person.handle,
      avatar: person.avatar,
      kind: row.kind,
      body: row.body,
      at: row.created_at,
    } satisfies StoryComment];
  });
  const wanted = [...new Set(comments.flatMap((comment) => (comment.kind === "text" ? handlesIn(comment.body) : [])))];
  const mentions: Record<string, string> = {};
  if (wanted.length) {
    const { data } = await admin.from("profiles").select("id, handle").or(wanted.map((handle) => `handle.ilike.${handle}`).join(",")).limit(50);
    for (const row of data ?? []) mentions[String(row.handle).toLowerCase()] = row.id as string;
  }
  return { comments, mentions };
}

/** One page of a story's public comments, newest page first, drawn oldest-to-newest. */
export async function loadStoryComments(storyId: string, before?: string): Promise<CommentPage | Fail> {
  if (!idSchema.safeParse(storyId).success) return { ok: false, error: "That story is unavailable." };
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in to continue" };
  const visible = await visibleStory(caller.userId, storyId);
  if (!visible) return { ok: false, error: "That story is unavailable." };
  const blocked = visible.blocked ?? await blockedEitherWay(caller.userId);

  let query = caller.admin
    .from("story_comments")
    .select("id, story_id, author_id, kind, body, created_at")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (before) query = query.lt("created_at", before);
  const [page, count] = await Promise.all([
    query,
    caller.admin.from("story_comments").select("id", { count: "exact", head: true }).eq("story_id", storyId),
  ]);
  if (missingTable(page.error) || missingTable(count.error)) {
    return { comments: [], count: 0, older: null, mentions: {}, warning: SQL_HINT };
  }
  if (page.error) return { ok: false, error: "Could not load comments." };
  const rows = ((page.data ?? []) as CommentRow[]).slice().reverse();
  const shaped = await toComments(caller.admin, rows, blocked);
  const older = (page.data ?? []).length === PAGE ? rows[0]?.created_at ?? null : null;
  return { comments: shaped.comments, count: count.count ?? shaped.comments.length, older, mentions: shaped.mentions, warning: "" };
}

export async function postStoryComment(storyId: string, body: string, kind: CommentKind = "text"): Promise<{ ok: true; comment: StoryComment; count: number } | Fail> {
  if (!idSchema.safeParse(storyId).success) return { ok: false, error: "That story is unavailable." };
  const trimmed = body.trim();
  if (kind === "gif" || kind === "sticker") {
    if (trimmed.length > 2000 || !allowedMediaUrl(trimmed)) return { ok: false, error: "That media link is not allowed." };
  } else if (kind === "emoji") {
    if (!isEmojiMessage(trimmed)) return { ok: false, error: "Send an emoji, or write a comment." };
  } else if (!textSchema.safeParse(trimmed).success) {
    return { ok: false, error: "Write a comment first." };
  }
  const member = await getMember();
  if ("error" in member) return member;
  const visible = await visibleStory(member.userId, storyId);
  if (!visible) return { ok: false, error: "That story is unavailable." };
  if (rateLimited(`story-comment:${member.userId}`, 20, 60_000)) return SLOW_DOWN;
  const resolved = kind === "text" && isEmojiMessage(trimmed) ? "emoji" : kind;
  const { data, error } = await member.admin
    .from("story_comments")
    .insert({ story_id: storyId, author_id: member.userId, kind: resolved, body: trimmed })
    .select("id, story_id, author_id, kind, body, created_at")
    .single();
  if (error || !data) {
    console.error("story_comments insert failed", error?.code, error?.message);
    if (missingTable(error)) return { ok: false, error: SQL_HINT };
    return { ok: false, error: "Could not post that comment." };
  }
  const shaped = await toComments(member.admin, [data as CommentRow], new Set());
  const comment = shaped.comments[0];
  if (!comment) return { ok: false, error: "Could not post that comment." };
  const { count } = await member.admin.from("story_comments").select("id", { count: "exact", head: true }).eq("story_id", storyId);
  return { ok: true, comment, count: count ?? 0 };
}
