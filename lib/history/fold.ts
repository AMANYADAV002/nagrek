export interface FoldMatch {
  id: string;
  partnerId: string;
  food: string;
  at: string;
}

export interface FoldVisit {
  partnerId: string;
  placeName: string;
  at: string;
  confirmed: boolean;
}

export interface FoldInvite {
  id: string;
  fromId: string;
  toId: string;
  food: string;
  status: "pending" | "accepted" | "declined";
}

export interface HistoryCard {
  partnerId: string;
  matchId: string;
  food: string;
  placeName: string | null;
  metAt: string;
  invite: { id: string; food: string; incoming: boolean } | null;
}

/**
 * One card per person you've matched with. The newest match supplies the craving.
 * A confirmed visit supplies the venue and, when it is later, the date.
 */
export function foldHistory(me: string, matches: FoldMatch[], visits: FoldVisit[], invites: FoldInvite[]): HistoryCard[] {
  const byPartner = new Map<string, HistoryCard>();
  for (const match of [...matches].sort((a, b) => a.at.localeCompare(b.at))) {
    byPartner.set(match.partnerId, {
      partnerId: match.partnerId,
      matchId: match.id,
      food: match.food,
      placeName: null,
      metAt: match.at,
      invite: null,
    });
  }

  for (const visit of [...visits].filter((v) => v.confirmed).sort((a, b) => a.at.localeCompare(b.at))) {
    const card = byPartner.get(visit.partnerId);
    if (!card) continue;
    if (!card.placeName || visit.at >= card.metAt) card.placeName = visit.placeName;
    if (visit.at > card.metAt) card.metAt = visit.at;
  }

  for (const invite of invites) {
    if (invite.status !== "pending") continue;
    const partnerId = invite.fromId === me ? invite.toId : invite.toId === me ? invite.fromId : "";
    const card = partnerId ? byPartner.get(partnerId) : undefined;
    if (!card) continue;
    card.invite = { id: invite.id, food: invite.food, incoming: invite.toId === me };
  }

  return [...byPartner.values()].sort((a, b) => b.metAt.localeCompare(a.metAt));
}
