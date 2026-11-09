"use server";

import { z } from "zod";
import { blockedEitherWay, loadPeople, loadPerson, type Person } from "@/lib/people";
import { getCaller } from "@/lib/server/caller";

const idsSchema = z.array(z.string().min(1).max(64)).max(100);

/**
 * Public cards for the given ids. People who blocked the caller are left out, but people the
 * caller blocked are kept so the Blocked tab can show who to unblock.
 */
export async function getPeople(ids: string[]): Promise<Person[]> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success || !parsed.data.length) return [];
  const caller = await getCaller();
  if (!caller) return [];
  const { data: blockedMe } = await caller.admin.from("blocks").select("blocker_id").eq("blocked_id", caller.userId);
  const hidden = new Set((blockedMe ?? []).map((b) => b.blocker_id as string));
  return (await loadPeople(parsed.data.filter((id) => !hidden.has(id)))).filter((p) => p.id !== caller.userId);
}

/** Recently joined people to follow or connect with. */
export async function discoverPeople(): Promise<Person[]> {
  const caller = await getCaller();
  if (!caller) return [];
  const { admin, userId } = caller;
  const [{ data }, blocked] = await Promise.all([
    admin
      .from("profiles")
      .select("id")
      .not("onboarded_at", "is", null)
      .eq("suspended", false)
      .neq("id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    blockedEitherWay(userId),
  ]);
  return loadPeople((data ?? []).map((r) => r.id as string).filter((id) => !blocked.has(id)));
}

/** A profile page, unless either person blocked the other. */
export async function getPerson(id: string): Promise<Person | null> {
  if (!z.string().min(1).max(64).safeParse(id).success) return null;
  const caller = await getCaller();
  if (!caller) return null;
  if (id !== caller.userId && (await blockedEitherWay(caller.userId)).has(id)) return null;
  return loadPerson(id);
}
