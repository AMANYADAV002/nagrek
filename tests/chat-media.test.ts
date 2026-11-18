import { describe, expect, it } from "vitest";
import { allowedMediaUrl, fallbackMedia, isEmojiMessage, mediaFileSrc, playableMediaUrl } from "@/lib/chat/media";

describe("chat media", () => {
  it("allows https Giphy and Tenor hosts only", () => {
    expect(allowedMediaUrl("https://media.giphy.com/media/abc/giphy.gif")).toBe(true);
    expect(allowedMediaUrl("https://media.tenor.com/abc/file.gif")).toBe(true);
    expect(allowedMediaUrl("https://giphy.com/gifs/pizza")).toBe(true);
    expect(allowedMediaUrl("http://media.giphy.com/a.gif")).toBe(false);
    expect(allowedMediaUrl("https://evil.com/giphy.gif")).toBe(false);
    expect(allowedMediaUrl("https://media.giphy.com.evil.com/a.gif")).toBe(false);
    expect(allowedMediaUrl("not a url")).toBe(false);
  });

  it("treats a short emoji run as a large emoji, including a skin tone", () => {
    expect(isEmojiMessage("😋")).toBe(true);
    expect(isEmojiMessage("😋🍕")).toBe(true);
    expect(isEmojiMessage("👍🏻")).toBe(true);
    expect(isEmojiMessage("hi 😋")).toBe(false);
    expect(isEmojiMessage("1")).toBe(false);
    expect(isEmojiMessage("")).toBe(false);
  });

  it("plays the gif beside a giphy webp that browsers leave blank", () => {
    expect(playableMediaUrl("https://media1.giphy.com/media/abc/giphy.webp")).toBe("https://media1.giphy.com/media/abc/giphy.gif");
    expect(playableMediaUrl("https://media1.giphy.com/media/abc/giphy.webp?rid=giphy.webp&ct=g")).toBe("https://media1.giphy.com/media/abc/giphy.gif?rid=giphy.gif");
    expect(playableMediaUrl("https://media1.giphy.com/media/abc/200.gif")).toBe("https://media1.giphy.com/media/abc/200.gif");
    expect(playableMediaUrl("https://evil.com/a.webp")).toBe("https://evil.com/a.webp");
  });

  it("loads a giphy gif through this app", () => {
    const remote = "https://media0.giphy.com/media/abc/100w.gif";
    expect(mediaFileSrc(remote)).toBe(`/api/media/file?src=${encodeURIComponent(remote)}`);
    expect(mediaFileSrc("https://media1.giphy.com/media/abc/giphy.webp")).toBe(
      `/api/media/file?src=${encodeURIComponent("https://media1.giphy.com/media/abc/giphy.gif")}`,
    );
    expect(mediaFileSrc("https://evil.com/a.gif")).toBe("");
    expect(mediaFileSrc("https://media.giphy.com/media/abc/clip.mp4")).toBe("");
  });

  it("falls back to craving reactions when search has no key", () => {
    expect(fallbackMedia("gif", "").map((item) => item.emoji)).toContain("🍕");
    expect(fallbackMedia("gif", "pizza").every((item) => item.title.toLowerCase().includes("pizza") || item.emoji === "🍕")).toBe(true);
    expect(fallbackMedia("sticker", "cheers")[0]?.emoji).toBe("🥂");
    expect(fallbackMedia("gif", "zzzz-nope")).toEqual([]);
  });
});
