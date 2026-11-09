import type { Story } from "@/lib/types";
import { cravings } from "@/lib/data/cravings";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** Phase 1 mock stories. TODO(phase-6): Supabase Storage uploads with 24h expiry. */
export const mockStories: Story[] = [
  { id: "s1", userId: "u-aisha", kind: "image", src: cravings[2].image, caption: "Coffee + the best conversation about books", createdAt: hoursAgo(2), views: 128 },
  { id: "s2", userId: "u-aisha", kind: "image", src: cravings[0].image, caption: "Pizza round two", createdAt: hoursAgo(1), views: 96 },
  { id: "s3", userId: "u-rohan", kind: "image", src: cravings[1].image, caption: "Met a fellow sushi nerd today", createdAt: hoursAgo(5), views: 210 },
  { id: "s4", userId: "u-meera", kind: "image", src: cravings[3].image, caption: "Burger Tuesday with new friends", createdAt: hoursAgo(8), views: 402 },
  { id: "s5", userId: "u-zara", kind: "image", src: cravings[0].image, caption: "This crust though", createdAt: hoursAgo(3), views: 77 },
  { id: "s6", userId: "u-arjun", kind: "image", src: cravings[2].image, caption: "Founder coffee chat, 10/10", createdAt: hoursAgo(11), views: 54 },
];

export function storiesByUser(): Map<string, Story[]> {
  const map = new Map<string, Story[]>();
  for (const s of mockStories) {
    const list = map.get(s.userId) ?? [];
    list.push(s);
    map.set(s.userId, list);
  }
  return map;
}
