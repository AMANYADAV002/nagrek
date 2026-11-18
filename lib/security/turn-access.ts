export type RelayCall = {
  userId: string;
  callerId: string;
  calleeId: string;
  status: string;
  callerVerified: boolean;
  calleeVerified: boolean;
  /** True when `matches.status` is `live` for this pair. That is the mutually accepted match. */
  matchLive: boolean;
  /** True when `connections.status` is `accepted` for this pair. */
  connectionAccepted?: boolean;
};

/**
 * TURN credentials are issued only to a person on an open call when the pair has a
 * live match or an accepted connection, and both people have a verified KYC record.
 */
export function callMayRelay(call: RelayCall): boolean {
  const participant = call.userId === call.callerId || call.userId === call.calleeId;
  const open = call.status === "ringing" || call.status === "accepted";
  const related = call.matchLive || call.connectionAccepted === true;
  return participant && open && related && call.callerVerified && call.calleeVerified && call.callerId !== call.calleeId;
}
