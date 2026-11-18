import { describe, expect, it } from "vitest";
import { bestTier, dietCompatible, foodLevel, sameCategory } from "@/lib/matching/food";
import {
  MATCH_WEIGHTS, MAX_DISTANCE_KM, haversineKm, matching_score, matchingScore, rankCandidates, toneCompatible,
  type MatchProfile,
} from "@/lib/matching/score";

const base: MatchProfile = {
  foodInterests: ["Biryani", "Coffee"],
  tone: "casual",
  city: "Bengaluru",
  point: { lat: 12.97, lng: 77.59 },
  dietary: "non-veg",
  budget: [300, 800],
  languages: ["English", "Hindi"],
};
const profile = (p: Partial<MatchProfile> = {}): MatchProfile => ({ ...base, ...p });

describe("matching weights", () => {
  it("sum to 1 with food weighted highest", () => {
    const values = Object.values(MATCH_WEIGHTS);
    expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(Math.max(...values)).toBe(MATCH_WEIGHTS.food);
  });
});

describe("toneCompatible", () => {
  it("matches same tone and treats random as a wildcard", () => {
    expect(toneCompatible("casual", "casual")).toBe(true);
    expect(toneCompatible("random", "professional")).toBe(true);
    expect(toneCompatible("professional", "random")).toBe(true);
    expect(toneCompatible("casual", "professional")).toBe(false);
  });
});

describe("haversineKm", () => {
  it("is zero for the same point and roughly right for a known distance", () => {
    expect(haversineKm(base.point!, base.point!)).toBe(0);
    // Bengaluru ? Mumbai is ~840 km
    expect(haversineKm({ lat: 12.97, lng: 77.59 }, { lat: 19.07, lng: 72.88 })).toBeGreaterThan(800);
  });
});

describe("matchingScore", () => {
  it("scores identical profiles at 100", () => {
    const r = matchingScore(base, profile());
    expect(r).toMatchObject({ compatible: true, score: 100, distanceKm: 0 });
  });

  it("rejects incompatible tones", () => {
    expect(matchingScore(base, profile({ tone: "professional" }))).toMatchObject({ compatible: false, score: 0, reason: "tone" });
  });

  it("rejects pairs with no shared food", () => {
    expect(matchingScore(base, profile({ foodInterests: ["Sushi"] })).reason).toBe("food");
  });

  it("uses the live craving instead of saved interests when given", () => {
    expect(matchingScore(base, profile({ foodInterests: ["Pizza"] }), { craving: "pizza" }).compatible).toBe(true);
    expect(matchingScore(base, profile(), { craving: "Pizza" }).reason).toBe("food");
  });

  it(`rejects people further than ${MAX_DISTANCE_KM} km`, () => {
    const far = matchingScore(base, profile({ point: { lat: 13.2, lng: 77.59 } }));
    expect(far.compatible).toBe(false);
    expect(far.reason).toBe("distance");
    expect(far.distanceKm).toBeGreaterThan(MAX_DISTANCE_KM);
  });

  it("falls back to city when coordinates are missing", () => {
    expect(matchingScore(profile({ point: undefined }), profile({ point: undefined })).breakdown.distance).toBe(0.5);
    expect(matchingScore(profile({ point: undefined }), profile({ point: undefined, city: "Delhi" })).reason).toBe("distance");
  });

  it("ranks closer and more similar people higher", () => {
    const near = matchingScore(base, profile({ point: { lat: 12.98, lng: 77.6 } })).score;
    const further = matchingScore(base, profile({ point: { lat: 13.05, lng: 77.6 } })).score;
    const lessFood = matchingScore(base, profile({ foodInterests: ["Biryani", "Ramen", "Pizza"] })).score;
    expect(near).toBeGreaterThan(further);
    expect(100).toBeGreaterThan(lessFood);
  });

  it("gives partial budget credit and keeps veg with vegan", () => {
    const r = matchingScore(profile({ dietary: "veg", budget: [200, 400] }), profile({ dietary: "vegan", budget: [300, 600] }));
    expect(r.compatible).toBe(true);
    expect(r.breakdown.dietary).toBe(0.75);
    expect(r.breakdown.budget).toBeCloseTo(100 / 400);
  });

  it("never crosses a dietary line", () => {
    expect(matchingScore(profile({ dietary: "veg" }), profile({ dietary: "non-veg" })).reason).toBe("dietary");
    expect(matchingScore(profile({ dietary: "jain" }), profile({ dietary: "non-veg" })).reason).toBe("dietary");
    expect(matchingScore(profile({ dietary: "halal" }), profile({ dietary: "non-veg" })).reason).toBe("dietary");
    expect(matchingScore(profile({ dietary: "vegan" }), profile({ dietary: "eggetarian" })).reason).toBe("dietary");
    expect(dietCompatible("jain", "veg")).toBe(false);
    expect(dietCompatible("jain", "jain")).toBe(true);
    expect(dietCompatible("veg", "eggetarian")).toBe(true);
  });

  it("is exported under the brief's name", () => {
    expect(matching_score).toBe(matchingScore);
  });
});

describe("food tiers", () => {
  it("treats paratha and chole bhature as the same North Indian category", () => {
    expect(sameCategory("Paratha", "Chole bhature")).toBe(true);
    expect(sameCategory("Paratha", "Sushi")).toBe(false);
    expect(foodLevel("Paratha", [], "Chole bhature", [])).toBe("category");
  });

  it("prefers the live craving, then a saved food, and only then a category", () => {
    expect(foodLevel("Paratha", ["Dosa"], "Paratha", ["Sushi"])).toBe("craving");
    expect(foodLevel("Paratha", ["Dosa"], "Ramen", ["Paratha"])).toBe("saved");
    expect(foodLevel("Paratha", ["Dosa"], "Dosa", ["Coffee"])).toBe("saved");
    expect(foodLevel("Paratha", [], null, ["Chole bhature"])).toBe("category");
    const chosen = bestTier([
      { tier: "category" as const, id: "north" },
      { tier: "saved" as const, id: "listed" },
      { tier: "craving" as const, id: "now" },
    ]);
    expect(chosen.map((r) => r.id)).toEqual(["now"]);
  });

  it("still recommends two people craving the same dish when tone or city differs", () => {
    const other = profile({ tone: "professional", city: "Delhi", point: undefined, foodInterests: ["Pizza"] });
    const mine = profile({ foodInterests: ["Pizza"] });
    expect(matchingScore(mine, other).compatible).toBe(false);
    expect(matchingScore(mine, other, { tier: "craving" }).compatible).toBe(true);
    expect(matchingScore(profile({ dietary: "jain" }), profile({ dietary: "veg" }), { tier: "craving" }).reason).toBe("dietary");
  });

  it("scores a category match below an exact craving", () => {
    const exact = matchingScore(base, profile({ foodInterests: ["Paratha"] }), { tier: "craving" }).score;
    const cousin = matchingScore(base, profile({ foodInterests: ["Chole bhature"] }), { tier: "category" }).score;
    expect(exact).toBeGreaterThan(cousin);
    expect(cousin).toBeGreaterThan(0);
  });
});

describe("rankCandidates", () => {
  it("drops incompatible candidates and sorts best first", () => {
    const ranked = rankCandidates(base, [
      { ...profile({ point: { lat: 13.05, lng: 77.6 } }), id: "far-ish" },
      { ...profile({ tone: "professional" }), id: "wrong-tone" },
      { ...profile(), id: "twin" },
    ]);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["twin", "far-ish"]);
  });
});
