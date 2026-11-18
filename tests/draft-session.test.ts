import { describe, expect, it } from "vitest";
import { parseDraft } from "@/lib/draft";
import { parseCachedSession } from "@/lib/mock/session";

describe("parseDraft", () => {
  it("returns the fallback for empty or broken text", () => {
    expect(parseDraft("", "Pizza")).toBe("Pizza");
    expect(parseDraft("{", { city: "Pune" })).toEqual({ city: "Pune" });
  });

  it("keeps a saved string and fills new object fields", () => {
    expect(parseDraft(JSON.stringify("coffee"), "")).toBe("coffee");
    expect(parseDraft(JSON.stringify({ city: "Pune" }), { city: "", area: "" })).toEqual({ city: "Pune", area: "" });
  });
});

describe("parseCachedSession", () => {
  it("rejects an unknown cache version", () => {
    expect(parseCachedSession("")).toBeNull();
    expect(parseCachedSession(JSON.stringify({ v: 2, state: { bio: "hi" } }))).toBeNull();
  });

  it("restores a profile snapshot and fills missing fields", () => {
    const session = parseCachedSession(JSON.stringify({ v: 1, state: { bio: "Loves dosa", user: { id: "u1", name: "Asha", email: "a@b.c", handle: "asha" } } }));
    expect(session?.bio).toBe("Loves dosa");
    expect(session?.user?.name).toBe("Asha");
    expect(session?.wishlist).toEqual([]);
  });
});
