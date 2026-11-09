"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { discoverPeople, getPeople } from "@/lib/actions/people";
import { getMockUser, mockUsers } from "@/lib/mock/users";
import { backendEnabled } from "@/lib/supabase/env";
import type { MockUser } from "@/lib/types";

/**
 * People cache shared by every screen. Live mode fetches public cards from the server;
 * demo mode reads the built-in demo people.
 */
const cache = new Map<string, MockUser | null>();
const pending = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function fetchMissing(ids: string[]) {
  const missing = ids.filter((id) => !cache.has(id) && !pending.has(id));
  if (!missing.length) return;
  missing.forEach((id) => pending.add(id));
  try {
    const people = await getPeople(missing);
    const found = new Map(people.map((p) => [p.id, p]));
    for (const id of missing) cache.set(id, found.get(id) ?? null);
  } finally {
    missing.forEach((id) => pending.delete(id));
    emit();
  }
}

export function rememberPeople(people: MockUser[]) {
  people.forEach((p) => cache.set(p.id, p));
  emit();
}

/** Resolves ids to people, in order, skipping anyone unknown, blocked or suspended. */
export function usePeople(ids: string[]): MockUser[] {
  const live = backendEnabled();
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  const key = ids.join(",");
  useEffect(() => {
    if (live && key) void fetchMissing(key.split(","));
  }, [live, key]);
  return useMemo(() => {
    void v;
    const list = key ? key.split(",") : [];
    return list
      .map((id) => (live ? (cache.get(id) ?? getMockUser(id)) : getMockUser(id)))
      .filter((p): p is MockUser => !!p);
  }, [key, live, v]);
}

export function usePerson(id: string | undefined): MockUser | undefined {
  return usePeople(id ? [id] : [])[0];
}

/** People to discover. Live: recently joined members. Demo: the built-in people. */
export function useDiscover(): { people: MockUser[]; loading: boolean } {
  const live = backendEnabled();
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => {
    if (!live || discovered !== null || discovering) return;
    discovering = true;
    void discoverPeople()
      .then((people) => {
        rememberPeople(people);
        discovered = people.map((p) => p.id);
      })
      .finally(() => {
        discovering = false;
        emit();
      });
  }, [live]);
  return useMemo(() => {
    void v;
    if (!live) return { people: mockUsers, loading: false };
    return {
      people: (discovered ?? []).map((id) => cache.get(id)).filter((p): p is MockUser => !!p),
      loading: discovered === null,
    };
  }, [live, v]);
}

let discovered: string[] | null = null;
let discovering = false;
