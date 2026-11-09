import "server-only";
import { calculateStreak, type StreakEvent } from "@/lib/streak/calc";
import type { getSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

/**
 * calculateStreak reads calendar days in the process's local time. Shift every timestamp so
 * that "local" equals India time, whatever timezone the host runs in.
 */
function asIndianLocal(d: Date): Date {
  return new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60_000);
}

/** First day of the current month in India, as stored in `streaks.month`. */
export function currentStreakMonth(now = new Date()): string {
  const ist = asIndianLocal(now);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-01`;
}

export function indianStreak(events: StreakEvent[], now = new Date()): number {
  return calculateStreak(
    events.map((e) => ({ ...e, at: asIndianLocal(new Date(e.at)) })),
    asIndianLocal(now),
  );
}

/** This month's counting events for a user (40 days covers any month boundary). */
export async function loadStreakEvents(admin: Admin, userId: string): Promise<StreakEvent[]> {
  const since = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const { data } = await admin.from("streak_events").select("type, at").eq("user_id", userId).gte("at", since).order("at");
  return (data ?? []) as StreakEvent[];
}

/** Records a completed meeting for each person (once per meeting) and stores the new streak. */
export async function recordMeetingStreak(admin: Admin, userIds: string[], meetingId: string) {
  await admin
    .from("streak_events")
    .upsert(
      userIds.map((user_id) => ({ user_id, type: "meeting_completed", meeting_id: meetingId })),
      { onConflict: "user_id,meeting_id", ignoreDuplicates: true },
    );
  for (const userId of userIds) await refreshStreak(admin, userId);
}

export async function refreshStreak(admin: Admin, userId: string): Promise<number> {
  const count = indianStreak(await loadStreakEvents(admin, userId));
  const month = currentStreakMonth();
  await admin.from("streaks").upsert({ user_id: userId, current_count: count, month, updated_at: new Date().toISOString() });
  return count;
}
