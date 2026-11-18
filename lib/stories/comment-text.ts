const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /(@[a-z0-9._]{2,30})|(https?:\/\/[^\s]+|\/profile\/[0-9a-f-]{36})/gi;

export type CommentPart =
  | { type: "text"; text: string }
  | { type: "mention"; handle: string }
  | { type: "profile"; id: string; label: string }
  | { type: "link"; href: string; label: string };

function clean(raw: string) {
  return raw.replace(/[.,);]+$/g, "");
}

/** A pasted Nagrek profile URL, relative or absolute. Anything else stays a normal link. */
export function profileIdFromUrl(raw: string): string | null {
  const value = clean(raw);
  try {
    const url = value.startsWith("/") ? new URL(value, "https://nagrek.local") : new URL(value);
    if (!value.startsWith("/") && url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    const match = url.pathname.match(/^\/profile\/([0-9a-f-]{36})\/?$/i);
    return match && UUID.test(match[1]) ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function externalHref(raw: string): string | null {
  const value = clean(raw);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Split a comment into text, @handles, profile links, and https links. Markup stays text. */
export function splitComment(body: string): CommentPart[] {
  const parts: CommentPart[] = [];
  let cursor = 0;
  for (const match of body.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: "text", text: body.slice(cursor, index) });
    const token = match[0];
    if (token.startsWith("@")) {
      parts.push({ type: "mention", handle: token.slice(1) });
    } else {
      const id = profileIdFromUrl(token);
      if (id) parts.push({ type: "profile", id, label: clean(token) });
      else {
        const href = externalHref(token);
        if (href) parts.push({ type: "link", href, label: clean(token) });
        else parts.push({ type: "text", text: token });
      }
    }
    cursor = index + token.length;
  }
  if (cursor < body.length) parts.push({ type: "text", text: body.slice(cursor) });
  return parts.length ? parts : [{ type: "text", text: body }];
}

export function handlesIn(body: string): string[] {
  return [...new Set(splitComment(body).flatMap((part) => (part.type === "mention" ? [part.handle.toLowerCase()] : [])))];
}

/** Same-origin return path. Rejects protocol-relative and off-site values. */
export function safeReturnPath(raw: string | undefined): string | undefined {
  if (!raw || raw.length > 200) return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return undefined;
  return raw;
}
