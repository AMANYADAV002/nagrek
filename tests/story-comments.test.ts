import { describe, expect, it } from "vitest";
import { profileIdFromUrl, safeReturnPath, splitComment } from "@/lib/stories/comment-text";

describe("story comment text", () => {
  it("keeps markup as text and links a profile url, a mention, and an https url", () => {
    const id = "6956c87e-7c08-441d-a768-d874e6937fb8";
    const parts = splitComment(`hi @aisha.eats see /profile/${id} and https://example.com/table. <script>alert(1)</script>`);
    expect(parts).toEqual([
      { type: "text", text: "hi " },
      { type: "mention", handle: "aisha.eats" },
      { type: "text", text: " see " },
      { type: "profile", id, label: `/profile/${id}` },
      { type: "text", text: " and " },
      { type: "link", href: "https://example.com/table", label: "https://example.com/table" },
      { type: "text", text: " <script>alert(1)</script>" },
    ]);
  });

  it("rejects javascript and protocol-relative return paths", () => {
    expect(profileIdFromUrl("javascript:alert(1)")).toBeNull();
    expect(splitComment("javascript:alert(1)")[0]).toEqual({ type: "text", text: "javascript:alert(1)" });
    expect(safeReturnPath("/stories")).toBe("/stories");
    expect(safeReturnPath("//evil.com")).toBeUndefined();
    expect(safeReturnPath("https://evil.com")).toBeUndefined();
    expect(safeReturnPath("/\\evil")).toBeUndefined();
  });
});
