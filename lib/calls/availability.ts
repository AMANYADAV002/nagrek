/** Unanswered calls stop ringing after this long and are not "busy". */
export const RING_MS = 45_000;
/** An accepted call that never connected was a refresh or a failed start, not a live call. */
export const ABANDONED_CALL_MS = 90_000;

export interface OpenCall {
  id: string;
  caller_id: string;
  callee_id: string;
  status: "ringing" | "accepted";
  created_at: string;
  connected_at?: string | null;
}

export type CallChoice = { action: "reuse"; callId: string } | { action: "busy" } | { action: "start" };

function involves(row: OpenCall, userId: string) {
  return row.caller_id === userId || row.callee_id === userId;
}

/**
 * A ringing or accepted row is only busy when it is actually live and with someone else.
 * A call between these two people is reused, so both can press Call after a match.
 */
export function callAvailability(me: string, them: string, rows: OpenCall[], now = Date.now()): CallChoice {
  const live = rows
    .filter((row) => {
      const age = now - new Date(row.created_at).getTime();
      if (row.status === "ringing") return age <= RING_MS;
      if (row.status !== "accepted") return false;
      if (!row.connected_at && age > ABANDONED_CALL_MS) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pair = live.find((row) => involves(row, me) && involves(row, them));
  if (pair) return { action: "reuse", callId: pair.id };
  if (live.some((row) => involves(row, them))) return { action: "busy" };
  return { action: "start" };
}
