"use client";

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { StoryGroup } from "@/components/story-viewer/story-viewer";
import { deleteStory, loadStories, markStorySeen, publishStory } from "@/lib/actions/stories";
import { mockStories } from "@/lib/mock/stories";
import { mockUsers } from "@/lib/mock/users";
import { updateSession, type SessionState } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";
import type { Story } from "@/lib/types";

export const STORY_TTL_MS = 24 * 3_600_000;
export const STORY_MAX_BYTES = 50 * 1024 * 1024;
export const STORY_MAX_VIDEO_SECONDS = 30;

/** Blob URLs only live for this page load; persisted ones from earlier loads are dead. */
const liveBlobUrls = new Set<string>();
export function registerBlobUrl(url: string) {
  liveBlobUrls.add(url);
}

function alive(s: Story, now: number) {
  if (now - new Date(s.createdAt).getTime() > STORY_TTL_MS) return false;
  if (s.src.startsWith("blob:") && !liveBlobUrls.has(s.src)) return false;
  return true;
}

/** Builds viewer groups: mine first, then everyone else, minus blocked users and reported stories. */
export function buildStoryGroups(session: SessionState): StoryGroup[] {
  const now = Date.now();
  const hidden = new Set(session.reports.filter((r) => r.targetType === "story").map((r) => r.targetId));
  const groups: StoryGroup[] = [];

  const mine = session.myStories.filter((s) => alive(s, now));
  if (mine.length && session.user) {
    groups.push({ userId: "me", name: "Your story", avatar: session.avatar, stories: mine, isMine: true });
  }
  for (const u of mockUsers) {
    if (session.blocked.includes(u.id)) continue;
    const stories = mockStories.filter((s) => s.userId === u.id && !hidden.has(s.id) && alive(s, now));
    if (stories.length) groups.push({ userId: u.id, name: u.name, avatar: u.avatar, stories });
  }
  return groups;
}

export function groupSeen(group: StoryGroup, seen: string[]) {
  return group.stories.every((s) => seen.includes(s.id));
}

/** Sources next/image can't optimise: local previews and short-lived signed Storage URLs. */
export function rawStorySrc(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:") || src.includes("/storage/v1/");
}

// ---------------------------------------------------------------------------
// Live stories (Supabase). Signed URLs last an hour, so the list refreshes every 30 minutes.
// ---------------------------------------------------------------------------

let liveGroups: StoryGroup[] | null = null;
let loading = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export async function refreshLiveStories() {
  if (loading) return;
  loading = true;
  try {
    liveGroups = await loadStories();
  } finally {
    loading = false;
    emit();
  }
}

/** Story groups for the current mode: Supabase when the backend is on, the demo set otherwise. */
export function useStoryGroups(session: SessionState | null): StoryGroup[] {
  const live = backendEnabled();
  const groups = useSyncExternalStore(subscribe, () => liveGroups, () => null);
  useEffect(() => {
    if (!live) return;
    if (liveGroups === null) void refreshLiveStories();
    const timer = setInterval(() => void refreshLiveStories(), 30 * 60_000);
    return () => clearInterval(timer);
  }, [live]);
  if (!session) return [];
  if (!live) return buildStoryGroups(session);
  const reported = new Set(session.reports.filter((r) => r.targetType === "story").map((r) => r.targetId));
  return (groups ?? [])
    .filter((g) => !session.blocked.includes(g.userId))
    .map((g) => ({ ...g, stories: g.stories.filter((s) => !reported.has(s.id)) }))
    .filter((g) => g.stories.length);
}

/** Seen and delete handlers shared by the row, the feed and profiles. */
export function storyHandlers() {
  const live = backendEnabled();
  return {
    onSeen: (id: string) => {
      updateSession((s) => (s.seenStories.includes(id) ? {} : { seenStories: [...s.seenStories, id] }));
      if (live) void markStorySeen(id);
    },
    onDelete: (id: string) => {
      if (!live) return updateSession((s) => ({ myStories: s.myStories.filter((x) => x.id !== id) }));
      void deleteStory(id).then((res) => {
        if (!res.ok) toast.error(res.error);
        void refreshLiveStories();
      });
    },
  };
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Uploads into the caller's own Storage folder, then asks the server to publish it. */
export async function uploadLiveStory(
  userId: string,
  blob: Blob,
  kind: "image" | "video",
  caption?: string,
  matchId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Backend not configured" };
  const ext = EXT[blob.type];
  if (!ext) return { ok: false, error: "Use a JPG, PNG, WebP, MP4, WebM or MOV file." };
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("stories").upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) return { ok: false, error: error.message };
  const res = await publishStory({ path, kind, caption, matchId });
  if (!res.ok) {
    await supabase.storage.from("stories").remove([path]);
    return res;
  }
  await refreshLiveStories();
  return { ok: true };
}

/** Client-side compression: downscale to 1080px and re-encode as JPEG. */
export async function compressImageBlob(file: File, maxSide = 1080, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not compress image"))), "image/jpeg", quality),
  );
}

/** Demo mode keeps stories in the browser as data URLs. */
export async function compressImage(file: File, maxSide = 1080, quality = 0.8): Promise<string> {
  const blob = await compressImageBlob(file, maxSide, quality);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

export function videoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.duration);
    v.onerror = () => reject(new Error("Could not read video"));
    v.src = url;
  });
}
