import "server-only";
import { blockedEitherWay } from "@/lib/people";
import type { Caller } from "@/lib/server/caller";

/**
 * Calls and visits are only between accepted connections who have not blocked each other.
 * Returns an error message, or null when `otherId` can be reached. Both ids must be validated UUIDs.
 */
export async function unreachableReason(admin: Caller["admin"], me: string, otherId: string): Promise<string | null> {
  if (me === otherId) return "That's you.";
  const [{ data: conn }, blocked, { data: other }] = await Promise.all([
    admin
      .from("connections")
      .select("status")
      .or(`and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`)
      .maybeSingle(),
    blockedEitherWay(me),
    admin.from("profiles").select("suspended, onboarded_at").eq("id", otherId).maybeSingle(),
  ]);
  if (!other || other.suspended || !other.onboarded_at || blocked.has(otherId)) return "This person isn't available.";
  if (conn?.status !== "accepted") return "You can only do this with your connections.";
  return null;
}
