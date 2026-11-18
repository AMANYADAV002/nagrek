"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, string>();

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => set.delete(listener);
}

function readRaw(key: string) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let raw = "";
  try {
    raw = localStorage.getItem(key) ?? "";
  } catch {
    raw = "";
  }
  cache.set(key, raw);
  return raw;
}

function writeRaw(key: string, raw: string) {
  cache.set(key, raw);
  try {
    if (raw) localStorage.setItem(key, raw);
    else localStorage.removeItem(key);
  } catch {
    // Storage full or blocked: the value still lives for this page.
  }
  listeners.get(key)?.forEach((listener) => listener());
}

/** Restore a saved draft. Objects gain any fields added since they were saved. */
export function parseDraft<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    if (parsed === null || typeof parsed !== "object") return parsed;
    if (Array.isArray(parsed) || Array.isArray(fallback) || typeof fallback !== "object" || fallback === null) return parsed;
    return { ...(fallback as object), ...(parsed as object) } as T;
  } catch {
    return fallback;
  }
}

/**
 * Form value that survives reload, Back, and a new tab.
 * The server render uses `fallback`, then the saved value appears. Passwords do not belong here.
 */
export function useDraft<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `nagrek.draft.${key}`;
  const raw = useSyncExternalStore(
    (listener) => subscribe(storageKey, listener),
    () => readRaw(storageKey),
    () => "",
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = parseDraft(readRaw(storageKey), fallback);
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      writeRaw(storageKey, JSON.stringify(resolved));
    },
    [storageKey, fallback],
  );
  const clear = useCallback(() => writeRaw(storageKey, ""), [storageKey]);
  return [parseDraft(raw, fallback), set, clear];
}
