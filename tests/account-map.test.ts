import { describe, expect, it } from "vitest";
import { accountFromRows, isUuid, preferencesRow, publicProfilePatch } from "@/lib/db/map";
import type { OnboardingInput } from "@/lib/validation/onboarding";

const input: OnboardingInput = {
  foodInterests: ["Coffee"],
  tone: "casual",
  location: { city: "Bengaluru", area: "Indiranagar", point: { lat: 12.971599, lng: 77.594566 } },
  dietary: "non-veg",
  budget: [200, 800],
  groupSize: "one-on-one",
  timeSlots: ["Dinner"],
  languages: ["English"],
  topics: ["Travel"],
  goals: ["Food buddies"],
  dateOfBirth: "1996-05-01",
  adult: true,
  respectful: true,
};

const me = "11111111-1111-4111-8111-111111111111";

describe("onboarding rows", () => {
  it("rounds coordinates and keeps them out of the public profile", () => {
    expect(preferencesRow(me, input)).toMatchObject({ lat: 12.97, lng: 77.59, date_of_birth: "1996-05-01" });
    const pub = publicProfilePatch(input);
    expect(pub).toMatchObject({ city: "Bengaluru", area: "Indiranagar", tone: "casual" });
    expect(pub).not.toHaveProperty("lat");
    expect(pub).not.toHaveProperty("date_of_birth");
  });
});

describe("accountFromRows", () => {
  const account = accountFromRows({
    email: "priya@example.com",
    profile: {
      id: me,
      name: "Priya",
      handle: "priya-1111",
      bio: "Hi",
      avatar: { skin: "s2", hair: "short", hairColor: "black", outfit: "tee", accessory: "none", background: "peach" },
      plan_id: "premium",
      plan_since: "2026-11-01T00:00:00Z",
      onboarded_at: "2026-11-01T00:00:00Z",
      notifications_enabled: false,
    },
    preferences: preferencesRow(me, input),
    consent: { adult: true, respectful: true, termsVersion: "2026-11-draft-1", acceptedAt: "2026-11-01T00:00:00Z" },
    following: ["22222222-2222-4222-8222-222222222222"],
    connections: [
      { requester_id: "33333333-3333-4333-8333-333333333333", addressee_id: me, status: "pending" },
      { requester_id: me, addressee_id: "44444444-4444-4444-8444-444444444444", status: "pending" },
      { requester_id: me, addressee_id: "55555555-5555-4555-8555-555555555555", status: "accepted" },
      { requester_id: me, addressee_id: "66666666-6666-4666-8666-666666666666", status: "rejected" },
    ],
    blocked: [],
    muted: [],
    wishes: [{ id: "77777777-7777-4777-8777-777777777777", kind: "place", title: "Cafe", note: null, created_at: "2026-11-01T00:00:00Z", wishlist_shares: [{ shared_with: "22222222-2222-4222-8222-222222222222" }] }],
    plans: [],
  });

  it("maps connection direction and drops rejected ones", () => {
    expect(account.connections).toEqual({
      "33333333-3333-4333-8333-333333333333": "pending-in",
      "44444444-4444-4444-8444-444444444444": "pending-out",
      "55555555-5555-4555-8555-555555555555": "accepted",
    });
  });

  it("keeps the private preference on the owner's session only", () => {
    expect(account.preferences?.location.point).toEqual({ lat: 12.97, lng: 77.59 });
    expect(account.wishlist[0]?.sharedWith).toEqual(["22222222-2222-4222-8222-222222222222"]);
    expect(account.plan).toBe("premium");
    expect(account.notificationsEnabled).toBe(false);
  });
});

describe("isUuid", () => {
  it("rejects the demo people ids", () => {
    expect(isUuid("u-aisha")).toBe(false);
    expect(isUuid(me)).toBe(true);
  });
});
