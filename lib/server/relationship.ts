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
  if (conn?.status === "accepted") return null;
  const { data: live } = await admin
    .from("matches")
    .select("id")
    .eq("status", "live")
    .or(`and(user_a.eq.${me},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${me})`)
    .limit(1)
    .maybeSingle();
  if (live) return null;
  return "You can only do this with your connections.";
}

/** A mutual match makes the two people connections, so visits and later calls are allowed. */
export async function connectMatchedPair(admin: Caller["admin"], a: string, b: string) {
  const { data: existing } = await admin
    .from("connections")
    .select("id, status")
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .maybeSingle();
  if (!existing) {
    await admin.from("connections").insert({ requester_id: a, addressee_id: b, status: "accepted" });
    return;
  }
  if (existing.status !== "accepted") {
    await admin.from("connections").update({ status: "accepted" }).eq("id", existing.id);
  }
}
