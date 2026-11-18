import { describe, expect, it } from "vitest";
import { swipeDecision } from "@/lib/matching/deck-queue";

describe("swipeDecision", () => {
  it("ignores a small drag", () => {
    expect(swipeDecision(40, 10)).toBeNull();
    expect(swipeDecision(-40, -10)).toBeNull();
  });

  it("skips on a left or right drag", () => {
    expect(swipeDecision(-130, 0)).toBe("left");
    expect(swipeDecision(130, 0)).toBe("right");
  });

  it("skips on a fast flick before the card travels far", () => {
    expect(swipeDecision(-20, -900)).toBe("left");
    expect(swipeDecision(20, 900)).toBe("right");
  });
});
