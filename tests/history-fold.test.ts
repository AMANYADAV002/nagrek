import { describe, expect, it } from "vitest";
import { foldHistory } from "@/lib/history/fold";
import { orderedPair } from "@/lib/history/pair";
import { canApplyLocalAnswer } from "@/lib/webrtc/answer-gate";

const me = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const them = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("call answer gate", () => {
  it("allows an answer only while a remote offer is current", () => {
    expect(canApplyLocalAnswer("have-remote-offer")).toBe(true);
    expect(canApplyLocalAnswer("stable")).toBe(false);
    expect(canApplyLocalAnswer("have-local-offer")).toBe(false);
  });
});

describe("history", () => {
  it("orders a pair the same way for both people", () => {
    expect(orderedPair(them, me)).toEqual(orderedPair(me, them));
    expect(orderedPair(me, them)[0] < orderedPair(me, them)[1]).toBe(true);
  });

  it("keeps the newest craving and the latest confirmed venue", () => {
    const cards = foldHistory(
      me,
      [
        { id: "m1", partnerId: them, food: "Coffee", at: "2026-11-01T10:00:00.000Z" },
        { id: "m2", partnerId: them, food: "Biryani", at: "2026-11-10T10:00:00.000Z" },
      ],
      [
        { partnerId: them, placeName: "Third Wave", at: "2026-11-02T12:00:00.000Z", confirmed: true },
        { partnerId: them, placeName: "Meghana", at: "2026-11-11T12:00:00.000Z", confirmed: true },
        { partnerId: them, placeName: "Maybe later", at: "2026-11-12T12:00:00.000Z", confirmed: false },
      ],
      [{ id: "i1", fromId: them, toId: me, food: "Thai", status: "pending" }],
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      food: "Biryani",
      placeName: "Meghana",
      metAt: "2026-11-11T12:00:00.000Z",
      matchId: "m2",
      invite: { id: "i1", food: "Thai", incoming: true },
    });
  });

  it("leaves the chat history in place when a request is declined", () => {
    const cards = foldHistory(
      me,
      [{ id: "m1", partnerId: them, food: "Coffee", at: "2026-11-01T10:00:00.000Z" }],
      [],
      [{ id: "i1", fromId: me, toId: them, food: "Dosa", status: "declined" }],
    );
    expect(cards[0]?.invite).toBeNull();
    expect(cards[0]?.food).toBe("Coffee");
  });
});
