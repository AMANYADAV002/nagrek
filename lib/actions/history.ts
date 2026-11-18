"use server";

import { z } from "zod";
import { allowedMediaUrl, isEmojiMessage } from "@/lib/chat/media";
import { foldHistory, type FoldInvite, type FoldMatch, type FoldVisit } from "@/lib/history/fold";
import { orderedPair } from "@/lib/history/pair";
import { blockedEitherWay, loadPeople, loadPerson } from "@/lib/people";
import { getCaller, getMember, type Caller, type Fail } from "@/lib/server/caller";
import { rateLimited, SLOW_DOWN } from "@/lib/server/rate-limit";
import { connectMatchedPair } from "@/lib/server/relationship";
import type { AvatarConfig } from "@/lib/types";

const idSchema = z.uuid();
const foodSchema = z.string().trim().min(1).max(40);
const vibeSchema = z.string().trim().max(80);
const textSchema = z.string().trim().min(1).max(500);
const voiceSchema = z.object({
  data: z.string().min(8).max(400_000),
  mime: z.enum(["audio/webm", "video/webm", "audio/mp4", "audio/ogg", "audio/mpeg"]),
});

const SQL_HINT = "Run supabase/migrations/20261111120000_history_chat.sql in the Supabase SQL editor, then try again.";
const MEDIA_HINT = "Run supabase/migrations/20261111190000_chat_media.sql in the Supabase SQL editor, then try again.";
type ChatKind = "text" | "voice" | "emoji" | "gif" | "sticker";

export interface HistoryEntry {
  partner: { id: string; name: string; avatar: AvatarConfig };
  matchId: string;
  food: string;
  placeName: string | null;
  metAt: string;
  invite: { id: string; food: string; incoming: boolean } | null;
}

export interface DirectMessage {
  id: string;
  from: string;
  kind: ChatKind;
  body: string;
  at: string;
  url: string | null;
}

interface MessageRow {
  id: string;
  pair_low: string;
  pair_high: string;
  sender_id: string;
  kind: ChatKind;
  body: string;
  created_at: string;
}

function missingTable(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("does not exist") || message.includes("schema cache");
}

async function notify(admin: Caller["admin"], userId: string, kind: string, payload: Record<string, string>) {
  await admin.from("notifications").insert({ user_id: userId, kind, payload });
}

async function nameOf(admin: Caller["admin"], userId: string) {
  const { data } = await admin.from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name ?? "Someone";
}

async function pastPartner(admin: Caller["admin"], me: string, them: string) {
  const [asA, asB, blocked] = await Promise.all([
    admin.from("matches").select("id").eq("user_a", me).eq("user_b", them).in("status", ["live", "ended"]).limit(1),
    admin.from("matches").select("id").eq("user_a", them).eq("user_b", me).in("status", ["live", "ended"]).limit(1),
    blockedEitherWay(me),
  ]);
  if (blocked.has(them)) return false;
  return (asA.data?.length ?? 0) > 0 || (asB.data?.length ?? 0) > 0;
}

/** People you have matched with, newest meetup first. Reads matches and visits that already exist. */
export async function loadHistory(): Promise<HistoryEntry[] | null> {
  const caller = await getCaller();
  if (!caller) return null;
  const { admin, userId } = caller;
  const matchColumns = "id, user_a, user_b, food, created_at";
  const visitColumns = "proposer_id, invitee_id, place_name, status, scheduled_at, verified_at";
  const [asA, asB, proposed, invited, sentInvites, receivedInvites] = await Promise.all([
    admin.from("matches").select(matchColumns).eq("user_a", userId).in("status", ["live", "ended"]).order("created_at", { ascending: false }).limit(80),
    admin.from("matches").select(matchColumns).eq("user_b", userId).in("status", ["live", "ended"]).order("created_at", { ascending: false }).limit(80),
    admin.from("visits").select(visitColumns).eq("proposer_id", userId).in("status", ["accepted", "verified"]).order("scheduled_at", { ascending: false }).limit(80),
    admin.from("visits").select(visitColumns).eq("invitee_id", userId).in("status", ["accepted", "verified"]).order("scheduled_at", { ascending: false }).limit(80),
    admin.from("craving_invites").select("id, from_id, to_id, food, status").eq("from_id", userId).eq("status", "pending").limit(40),
    admin.from("craving_invites").select("id, from_id, to_id, food, status").eq("to_id", userId).eq("status", "pending").limit(40),
  ]);

  const matches: FoldMatch[] = [...(asA.data ?? []), ...(asB.data ?? [])].map((row) => ({
    id: row.id,
    partnerId: row.user_a === userId ? row.user_b : row.user_a,
    food: row.food,
    at: row.created_at,
  }));
  const visits: FoldVisit[] = [...(proposed.data ?? []), ...(invited.data ?? [])].map((row) => ({
    partnerId: row.proposer_id === userId ? row.invitee_id : row.proposer_id,
    placeName: row.place_name,
    at: row.verified_at ?? row.scheduled_at,
    confirmed: row.status === "accepted" || row.status === "verified",
  }));
  const inviteRows: FoldInvite[] = missingTable(sentInvites.error) || missingTable(receivedInvites.error)
    ? []
    : [...(sentInvites.data ?? []), ...(receivedInvites.data ?? [])].map((row) => ({
        id: String(row.id),
        fromId: String(row.from_id),
        toId: String(row.to_id),
        food: String(row.food),
        status: row.status === "accepted" || row.status === "declined" ? row.status : "pending",
      }));
  const cards = foldHistory(userId, matches, visits, inviteRows);
  const people = await loadPeople(cards.map((card) => card.partnerId));
  const byId = new Map(people.map((person) => [person.id, person]));
  return cards.flatMap((card) => {
    const person = byId.get(card.partnerId);
    if (!person) return [];
    return [{ partner: { id: person.id, name: person.name, avatar: person.avatar }, matchId: card.matchId, food: card.food, placeName: card.placeName, metAt: card.metAt, invite: card.invite }];
  });
}

/** Ask a past match to meet again over a new craving. They choose whether to accept. */
export async function sendCravingInvite(toId: string, food: string, vibe?: string): Promise<{ ok: true } | Fail> {
  if (!idSchema.safeParse(toId).success || !foodSchema.safeParse(food).success) return { ok: false, error: "Pick a craving first." };
  if (vibe && !vibeSchema.safeParse(vibe).success) return { ok: false, error: "Keep the vibe short." };
  const member = await getMember();
  if ("error" in member) return member;
  if (rateLimited(`crave:${member.userId}`, 8, 60 * 60_000)) return SLOW_DOWN;
  if (!(await pastPartner(member.admin, member.userId, toId))) return { ok: false, error: "You can send this to people you've already matched with." };

  const { data, error } = await member.admin
    .from("craving_invites")
    .insert({
      from_id: member.userId,
      to_id: toId,
      food: food.trim(),
      vibe: vibe?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (missingTable(error)) return { ok: false, error: SQL_HINT };
    if (error?.code === "23505") return { ok: false, error: "You already have a craving request waiting with them." };
    return { ok: false, error: "Could not send that request." };
  }
  await notify(member.admin, toId, "craving_invite", {
    inviteId: data.id,
    from: member.userId,
    name: await nameOf(member.admin, member.userId),
    food: food.trim(),
    vibe: vibe?.trim() ?? "",
    partnerId: member.userId,
  });
  return { ok: true };
}

/** The recipient accepts or rejects. Accept opens a live match, the same path as a new mutual yes. */
export async function respondCravingInvite(inviteId: string, accept: boolean): Promise<{ ok: true; matchId?: string } | Fail> {
  if (!idSchema.safeParse(inviteId).success) return { ok: false, error: "That request is gone." };
  const member = await getMember();
  if ("error" in member) return member;
  const { admin, userId } = member;
  const { data: invite } = await admin.from("craving_invites").select("id, from_id, to_id, food, status").eq("id", inviteId).maybeSingle();
  if (!invite || invite.to_id !== userId) return { ok: false, error: "That request is gone." };
  if (invite.status !== "pending") return { ok: true };

  const { data: updated } = await admin
    .from("craving_invites")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", inviteId)
    .eq("to_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!updated) return { ok: true };

  const payload = { from: userId, name: await nameOf(admin, userId), food: invite.food, partnerId: userId };
  if (!accept) {
    await notify(admin, invite.from_id, "craving_declined", payload);
    return { ok: true };
  }

  await Promise.all([
    admin.from("matches").update({ status: "ended" }).eq("status", "live").eq("user_a", invite.from_id).eq("user_b", userId),
    admin.from("matches").update({ status: "ended" }).eq("status", "live").eq("user_a", userId).eq("user_b", invite.from_id),
  ]);

  const { data: match, error } = await admin
    .from("matches")
    .insert({
      user_a: invite.from_id,
      user_b: userId,
      food: invite.food,
      status: "live",
      a_decision: "accepted",
      b_decision: "accepted",
    })
    .select("id")
    .single();
  if (error || !match) {
    await admin.from("craving_invites").update({ status: "pending" }).eq("id", inviteId);
    return { ok: false, error: "Could not open the match." };
  }

  await Promise.all([
    admin.from("craving_invites").update({ match_id: match.id }).eq("id", inviteId),
    admin.from("craving_invites").update({ status: "declined" }).eq("from_id", userId).eq("to_id", invite.from_id).eq("status", "pending"),
    admin.from("meetings").upsert({ match_id: match.id }, { onConflict: "match_id", ignoreDuplicates: true }),
    connectMatchedPair(admin, invite.from_id, userId),
    notify(admin, invite.from_id, "craving_accepted", { ...payload, matchId: match.id }),
  ]);
  return { ok: true, matchId: match.id };
}

async function signVoice(admin: Caller["admin"], rows: MessageRow[]) {
  const paths = rows.filter((row) => row.kind === "voice").map((row) => row.body);
  const signed = new Map<string, string>();
  if (!paths.length) return signed;
  const { data } = await admin.storage.from("voice-notes").createSignedUrls(paths, 60 * 10);
  for (const item of data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  return signed;
}

function toMessage(row: MessageRow, urls: Map<string, string>): DirectMessage {
  return {
    id: row.id,
    from: row.sender_id,
    kind: row.kind,
    body: row.kind === "voice" ? "Voice note" : row.body,
    at: row.created_at,
    url: row.kind === "voice" ? urls.get(row.body) ?? null : null,
  };
}

/** Text and voice notes with someone from History. */
export async function loadThread(partnerId: string): Promise<{ partner: { id: string; name: string; avatar: AvatarConfig }; messages: DirectMessage[]; liveMatchId: string | null; food: string | null; hasPlace: boolean; warning: string } | Fail> {
  if (!idSchema.safeParse(partnerId).success) return { ok: false, error: "That chat is unavailable." };
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in to continue" };
  if (!(await pastPartner(caller.admin, caller.userId, partnerId))) return { ok: false, error: "You can message people you've already matched with." };
  const partner = await loadPerson(partnerId);
  if (!partner) return { ok: false, error: "That person is unavailable." };
  const [low, high] = orderedPair(caller.userId, partnerId);
  const pair = `and(user_a.eq.${caller.userId},user_b.eq.${partnerId}),and(user_a.eq.${partnerId},user_b.eq.${caller.userId})`;
  const visitPair = `and(proposer_id.eq.${caller.userId},invitee_id.eq.${partnerId}),and(proposer_id.eq.${partnerId},invitee_id.eq.${caller.userId})`;
  const [messages, liveAsA, liveAsB, latestMatch, openVisit] = await Promise.all([
    caller.admin.from("direct_messages").select("id, pair_low, pair_high, sender_id, kind, body, created_at").eq("pair_low", low).eq("pair_high", high).order("created_at", { ascending: false }).limit(80),
    caller.admin.from("matches").select("id").eq("user_a", caller.userId).eq("user_b", partnerId).eq("status", "live").order("created_at", { ascending: false }).limit(1),
    caller.admin.from("matches").select("id").eq("user_a", partnerId).eq("user_b", caller.userId).eq("status", "live").order("created_at", { ascending: false }).limit(1),
    caller.admin.from("matches").select("food").or(pair).order("created_at", { ascending: false }).limit(1),
    caller.admin.from("visits").select("id").or(visitPair).in("status", ["proposed", "accepted"]).limit(1),
  ]);
  const live = liveAsA.data?.[0]?.id ?? liveAsB.data?.[0]?.id ?? null;
  const food = latestMatch.data?.[0]?.food ?? null;
  const hasPlace = (openVisit.data?.length ?? 0) > 0;
  if (missingTable(messages.error)) {
    return { partner: { id: partner.id, name: partner.name, avatar: partner.avatar }, messages: [], liveMatchId: live, food, hasPlace, warning: SQL_HINT };
  }
  const rows = ((messages.data ?? []) as MessageRow[]).slice().reverse();
  const urls = await signVoice(caller.admin, rows);
  return { partner: { id: partner.id, name: partner.name, avatar: partner.avatar }, messages: rows.map((row) => toMessage(row, urls)), liveMatchId: live, food, hasPlace, warning: "" };
}

async function storeMessage(userId: string, partnerId: string, kind: ChatKind, body: string): Promise<{ ok: true; message: DirectMessage } | Fail> {
  const member = await getMember();
  if ("error" in member) return member;
  if (member.userId !== userId) return { ok: false, error: "Sign in to continue" };
  if (!(await pastPartner(member.admin, userId, partnerId))) return { ok: false, error: "You can message people you've already matched with." };
  if (rateLimited(`chat:${userId}`, 30, 60_000)) return SLOW_DOWN;
  const [low, high] = orderedPair(userId, partnerId);
  const insert = (stored: ChatKind) =>
    member.admin
      .from("direct_messages")
      .insert({ pair_low: low, pair_high: high, sender_id: userId, kind: stored, body })
      .select("id, pair_low, pair_high, sender_id, kind, body, created_at")
      .single();
  let result = await insert(kind);
  // Older databases only allow text and voice, and cap the body at 500 characters.
  if (result.error?.code === "23514" && kind !== "text" && kind !== "voice" && body.length <= 500) result = await insert("text");
  const { data, error } = result;
  if (error || !data) {
    console.error("direct_messages insert failed", error?.code, error?.message);
    if (missingTable(error)) return { ok: false, error: SQL_HINT };
    if (error?.code === "23514") return { ok: false, error: MEDIA_HINT };
    return { ok: false, error: "Could not send that." };
  }
  const row = data as MessageRow;
  const urls = await signVoice(member.admin, [row]);
  return { ok: true, message: toMessage(row, urls) };
}

export async function sendDirectMessage(
  partnerId: string,
  body: string,
  kind: "text" | "emoji" | "gif" | "sticker" = "text",
): Promise<{ ok: true; message: DirectMessage } | Fail> {
  const trimmed = body.trim();
  if (!idSchema.safeParse(partnerId).success) return { ok: false, error: "That chat is unavailable." };
  if (kind === "gif" || kind === "sticker") {
    if (trimmed.length > 2000 || !allowedMediaUrl(trimmed)) return { ok: false, error: "That media link is not allowed." };
  } else if (kind === "emoji") {
    if (!isEmojiMessage(trimmed)) return { ok: false, error: "Send an emoji, or write a message." };
  } else if (!textSchema.safeParse(trimmed).success) {
    return { ok: false, error: "Write a message first." };
  }
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in to continue" };
  const resolved = kind === "text" && isEmojiMessage(trimmed) ? "emoji" : kind;
  return storeMessage(caller.userId, partnerId, resolved, trimmed);
}

export async function sendVoiceNote(partnerId: string, data: string, mime: string): Promise<{ ok: true; message: DirectMessage } | Fail> {
  const parsed = voiceSchema.safeParse({ data, mime });
  if (!idSchema.safeParse(partnerId).success || !parsed.success) return { ok: false, error: "That voice note could not be sent." };
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "Sign in to continue" };
  if (!(await pastPartner(caller.admin, caller.userId, partnerId))) return { ok: false, error: "You can message people you've already matched with." };
  const bytes = Buffer.from(parsed.data.data, "base64");
  if (bytes.length < 80 || bytes.length > 300_000) return { ok: false, error: "Keep the voice note under 15 seconds." };
  const id = crypto.randomUUID();
  const ext = parsed.data.mime.includes("mp4") ? "m4a" : parsed.data.mime.includes("ogg") ? "ogg" : "webm";
  const path = `${caller.userId}/${id}.${ext}`;
  const { error } = await caller.admin.storage.from("voice-notes").upload(path, bytes, { contentType: parsed.data.mime, upsert: false });
  if (error) return { ok: false, error: error.message.includes("Bucket") ? SQL_HINT : "Could not save that voice note." };
  const stored = await storeMessage(caller.userId, partnerId, "voice", path);
  if (!stored.ok) await caller.admin.storage.from("voice-notes").remove([path]);
  return stored;
}
