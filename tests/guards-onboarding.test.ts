import { describe, expect, it } from "vitest";
import { homeFor, redirectFor } from "@/lib/guards";
import { ageFrom, legalStep, roundCoord } from "@/lib/validation/onboarding";

describe("redirectFor", () => {
  const anon = { signedIn: false, onboarded: false, plan: null };
  const fresh = { signedIn: true, onboarded: false, plan: null };
  const onboarded = { signedIn: true, onboarded: true, plan: null };
  const paid = { signedIn: true, onboarded: true, plan: "plus" as const };

  it("sends anonymous users to sign-in", () => {
    expect(redirectFor("auth", anon)).toBe("/sign-in");
    expect(redirectFor("plan", anon)).toBe("/sign-in");
  });

  it("enforces onboarding, then a plan", () => {
    expect(redirectFor("auth", fresh)).toBeNull();
    expect(redirectFor("onboarded", fresh)).toBe("/onboarding");
    expect(redirectFor("plan", onboarded)).toBe("/plans");
    expect(redirectFor("plan", paid)).toBeNull();
  });

  it("picks the right landing page", () => {
    expect([anon, fresh, onboarded, paid].map(homeFor)).toEqual(["/sign-in", "/onboarding", "/plans", "/dashboard"]);
  });
});

describe("18+ gate", () => {
  const now = new Date(2026, 10, 20);

  it("computes whole years, respecting birthdays", () => {
    expect(ageFrom("2008-11-20", now)).toBe(18);
    expect(ageFrom("2008-11-21", now)).toBe(17);
    expect(ageFrom("not-a-date", now)).toBe(-1);
  });

  it("rejects under-18s and unchecked consent", () => {
    const adult = { dateOfBirth: "1995-01-01", adult: true, respectful: true };
    expect(legalStep.safeParse(adult).success).toBe(true);
    expect(legalStep.safeParse({ ...adult, dateOfBirth: `${new Date().getFullYear() - 10}-01-01` }).success).toBe(false);
    expect(legalStep.safeParse({ ...adult, adult: false }).success).toBe(false);
    expect(legalStep.safeParse({ ...adult, respectful: false }).success).toBe(false);
  });
});

describe("location privacy", () => {
  it("rounds coordinates to ~1 km", () => {
    expect(roundCoord(12.971599)).toBe(12.97);
    expect(roundCoord(77.594566)).toBe(77.59);
  });
});
