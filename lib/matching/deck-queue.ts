import type { MockUser } from "@/lib/types";

export interface DeckCard {
  user: MockUser;
  score: number;
  distanceKm?: number;
  requestId?: string;
}

export interface SavedMatchQueue {
  index: number;
  food: string;
  cards: DeckCard[];
  expiresAt: number;
  note: string | null;
  kind: "live" | "pinged";
  pinged: number;
}

export const MATCH_QUEUE_KEY = "nagrek-match-queue";

const listeners = new Set<() => void>();

function emitQueue() {
  listeners.forEach((listener) => listener());
}

export function subscribeMatchQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function matchQueueSnapshot(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(MATCH_QUEUE_KEY) ?? "";
}

export function parseMatchQueue(raw: string): SavedMatchQueue | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as SavedMatchQueue;
    if (!saved.cards?.length || saved.expiresAt < Date.now()) return null;
    saved.index = Math.min(Math.max(0, saved.index || 0), saved.cards.length - 1);
    return saved;
  } catch {
    return null;
  }
}

/** Left or right both move to the next person. Accept stays on the button. */
export function swipeDecision(offsetX: number, velocityX: number): "left" | "right" | null {
  if (offsetX <= -120 || velocityX <= -800) return "left";
  if (offsetX >= 120 || velocityX >= 800) return "right";
  return null;
}

export function saveMatchQueue(queue: SavedMatchQueue) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MATCH_QUEUE_KEY, JSON.stringify(queue));
  emitQueue();
}

export function readMatchQueue(): SavedMatchQueue | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(MATCH_QUEUE_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as SavedMatchQueue;
    if (!saved.cards?.length || saved.expiresAt < Date.now()) {
      sessionStorage.removeItem(MATCH_QUEUE_KEY);
      return null;
    }
    saved.index = Math.min(Math.max(0, saved.index || 0), saved.cards.length - 1);
    return saved;
  } catch {
    sessionStorage.removeItem(MATCH_QUEUE_KEY);
    return null;
  }
}

export function clearMatchQueue() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(MATCH_QUEUE_KEY);
  emitQueue();
}
