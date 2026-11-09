"use client";

import type { StoryGroup } from "@/components/story-viewer/story-viewer";
import { mockStories } from "@/lib/mock/stories";
import { mockUsers } from "@/lib/mock/users";
import type { SessionState } from "@/lib/mock/session";
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

/** Client-side compression: downscale to 1080px and re-encode as JPEG (TODO(phase-6): upload to Supabase Storage). */
export async function compressImage(file: File, maxSide = 1080, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
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
