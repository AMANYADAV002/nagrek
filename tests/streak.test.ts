import { describe, expect, it } from "vitest";
import { calculateStreak, milestoneProgress, rewardEligibility, type StreakEvent } from "@/lib/streak/calc";

// 20 Nov 2026, 3pm local time
const NOW = new Date(2026, 10, 20, 15);
const day = (offset: number, type: StreakEvent["type"] = "meeting_completed", hour = 19): StreakEvent => ({
  type,
  at: new Date(2026, 10, 20 - offset, hour),
});

describe("calculateStreak", () => {
  it("is 0 with no events", () => {
    expect(calculateStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(calculateStreak([day(0, "meeting_completed", 10), day(1), day(2)], NOW)).toBe(3);
  });

  it("still counts a streak that ended yesterday", () => {
    expect(calculateStreak([day(1), day(2), day(3)], NOW)).toBe(3);
  });

  it("breaks when there is a gap of a full day", () => {
    expect(calculateStreak([day(2), day(3)], NOW)).toBe(0);
    expect(calculateStreak([day(0, "meeting_completed", 9), day(1), day(3), day(4)], NOW)).toBe(2);
  });

  it("counts several events on one day once", () => {
    expect(calculateStreak([day(0, "meeting_completed", 9), day(0, "join_accepted", 12), day(1)], NOW)).toBe(2);
  });

  it("ignores non-counting events", () => {
    expect(calculateStreak([day(0, "app_open", 9), day(1, "app_open")], NOW)).toBe(0);
  });

  it("counts join_accepted the same as meeting_completed", () => {
    expect(calculateStreak([day(0, "join_accepted", 9), day(1, "join_accepted")], NOW)).toBe(2);
  });

  it("ignores events later today that have not happened yet", () => {
    expect(calculateStreak([day(0, "meeting_completed", 22)], NOW)).toBe(0);
  });

  it("resets at the start of each month", () => {
    const dec2 = new Date(2026, 11, 2, 12);
    const events: StreakEvent[] = [28, 29, 30].map((d) => ({ type: "meeting_completed", at: new Date(2026, 10, d, 19) }));
    events.push({ type: "meeting_completed", at: new Date(2026, 11, 1, 19) }, { type: "meeting_completed", at: new Date(2026, 11, 2, 9) });
    expect(calculateStreak(events, dec2)).toBe(2);
  });
});

describe("milestoneProgress", () => {
  it("reports the next milestone and progress toward it", () => {
    expect(milestoneProgress(0)).toEqual({ prev: 0, next: 3, progress: 0 });
    expect(milestoneProgress(5)).toEqual({ prev: 3, next: 7, progress: 0.5 });
    expect(milestoneProgress(7)).toEqual({ prev: 7, next: 15, progress: 0 });
  });

  it("is complete after the last milestone", () => {
    expect(milestoneProgress(31)).toEqual({ prev: 30, next: null, progress: 1 });
  });
});

describe("rewardEligibility", () => {
  const reward = { id: "r1", minVisits: 3, minPlan: "premium" as const, expiresAt: "2026-12-31", stock: 10 };
  const ok = { visits: 3, plan: "premium" as const, claimedIds: [], now: NOW };

  it("is eligible when every rule passes", () => {
    expect(rewardEligibility(reward, ok)).toEqual({ eligible: true });
    expect(rewardEligibility(reward, { ...ok, plan: "ultra", visits: 9 })).toEqual({ eligible: true });
  });

  it("requires enough verified visits", () => {
    expect(rewardEligibility(reward, { ...ok, visits: 2 })).toEqual({ eligible: false, reason: "visits" });
  });

  it("requires a high enough plan", () => {
    expect(rewardEligibility(reward, { ...ok, plan: "plus" })).toEqual({ eligible: false, reason: "plan" });
    expect(rewardEligibility(reward, { ...ok, plan: null })).toEqual({ eligible: false, reason: "plan" });
  });

  it("rejects claimed, expired and out-of-stock rewards first", () => {
    expect(rewardEligibility(reward, { ...ok, claimedIds: ["r1"] }).reason).toBe("claimed");
    expect(rewardEligibility({ ...reward, expiresAt: "2026-11-01" }, ok).reason).toBe("expired");
    expect(rewardEligibility({ ...reward, stock: 0 }, ok).reason).toBe("out_of_stock");
  });
});
