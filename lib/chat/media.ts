export type MediaKind = "gif" | "sticker";

export interface MediaHit {
  id: string;
  kind: MediaKind;
  title: string;
  preview: string;
  url: string;
  emoji: string;
  width: number;
  height: number;
}

const HOSTS = ["giphy.com", "tenor.com"];

/**
 * Older messages stored Giphy's WebP file, which browsers leave blank.
 * Swap the extension and drop the tracking bits so the matching GIF plays.
 */
export function playableMediaUrl(raw: string): string {
  if (!/\.webp/i.test(raw) && !/[&?]ct=/i.test(raw) && !/[&?]rid=/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/\.webp$/i, ".gif");
    url.searchParams.delete("ct");
    const rid = url.searchParams.get("rid");
    if (rid && /\.webp/i.test(rid)) url.searchParams.set("rid", rid.replace(/\.webp/gi, ".gif"));
    const next = url.toString();
    return allowedMediaUrl(next) ? next : raw;
  } catch {
    return raw;
  }
}

/**
 * Same-origin address for a Giphy or Tenor GIF.
 * The picker used to point `<img>` straight at media*.giphy.com. That file is a real
 * GIF, but the image request dies before a response and the tile's error path paints
 * a gray box. Loading it through this app keeps the bytes and the content type.
 */
export function mediaFileSrc(raw: string): string {
  const url = playableMediaUrl(raw);
  if (!allowedMediaUrl(url)) return "";
  try {
    if (!new URL(url).pathname.toLowerCase().endsWith(".gif")) return "";
  } catch {
    return "";
  }
  return `/api/media/file?src=${encodeURIComponent(url)}`;
}

/** GIFs and stickers may only come from Giphy or Tenor over HTTPS. */
export function allowedMediaUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** One to a few emoji graphemes, including skin tones and ZWJ sequences. */
export function isEmojiMessage(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 32) return false;
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) return false;
  const rest = trimmed.replace(/\p{Extended_Pictographic}|\p{Emoji_Component}|[\u200d\ufe0f]/gu, "");
  return rest.length === 0;
}

export const CRAVING_CHIPS = [
  { label: "Hungry", query: "hungry food" },
  { label: "Coffee", query: "coffee" },
  { label: "Pizza", query: "pizza" },
  { label: "Let's Go", query: "lets go" },
  { label: "Cheers", query: "cheers" },
  { label: "Love it", query: "love" },
  { label: "Wow", query: "wow" },
  { label: "Haha", query: "laughing" },
] as const;

const REACTIONS: { id: string; title: string; emoji: string; tags: string; kind: MediaKind }[] = [
  { id: "hungry", title: "Hungry", emoji: "😋", tags: "hungry food craving", kind: "gif" },
  { id: "coffee", title: "Coffee", emoji: "☕", tags: "coffee", kind: "gif" },
  { id: "pizza", title: "Pizza", emoji: "🍕", tags: "pizza", kind: "gif" },
  { id: "love", title: "Love it", emoji: "😍", tags: "love reaction", kind: "gif" },
  { id: "wow", title: "Wow", emoji: "🤩", tags: "wow reaction", kind: "gif" },
  { id: "haha", title: "Haha", emoji: "😂", tags: "laughing haha", kind: "gif" },
  { id: "lets-go", title: "Let's go", emoji: "🏃", tags: "lets go", kind: "sticker" },
  { id: "cheers", title: "Cheers", emoji: "🥂", tags: "cheers", kind: "sticker" },
  { id: "fire", title: "Fire", emoji: "🔥", tags: "fire spicy", kind: "sticker" },
  { id: "yum", title: "Yum", emoji: "🤤", tags: "yum hungry food", kind: "sticker" },
  { id: "yes", title: "Yes", emoji: "👍", tags: "yes thumbs", kind: "sticker" },
  { id: "heart", title: "Heart", emoji: "❤️", tags: "heart love", kind: "sticker" },
];

/** Shown when GIPHY_API_KEY is missing or Giphy does not answer. */
export function fallbackMedia(kind: MediaKind, query: string): MediaHit[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matched = REACTIONS.filter((item) => {
    const hay = `${item.title} ${item.tags}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
  const list = (words.length ? matched : REACTIONS.filter((item) => item.kind === kind)).slice(0, 24);
  return list.map((item) => ({
    id: `${kind}-${item.id}`,
    kind,
    title: item.title,
    preview: "",
    url: "",
    emoji: item.emoji,
    width: 0,
    height: 0,
  }));
}
