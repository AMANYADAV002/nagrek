"use server";

import { z } from "zod";
import { getCaller, type Fail } from "@/lib/server/caller";

/** Signed-in caller whose profile has role = 'admin'. Checked on every admin call. */
async function requireAdmin() {
  const caller = await getCaller();
  if (!caller) return null;
  const { data } = await caller.admin.from("profiles").select("role").eq("id", caller.userId).single();
  return data?.role === "admin" ? caller : null;
}

export async function isAdmin(): Promise<boolean> {
  return !!(await requireAdmin());
}

export interface AdminReport {
  id: string;
  targetType: "user" | "story" | "meeting";
  targetId: string;
  targetName: string;
  /** The person who would be warned or suspended. */
  targetUserId: string | null;
  reporterName: string;
  reason: string;
  details: string | null;
  status: "open" | "dismissed" | "actioned";
  createdAt: string;
  storyPreview: { kind: "image" | "video"; src: string; caption: string | null } | null;
}

export async function listReports(status: "open" | "all" = "open"): Promise<AdminReport[] | null> {
  const admin = (await requireAdmin())?.admin;
  if (!admin) return null;
  let query = admin
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, details, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status === "open") query = query.eq("status", "open");
  const { data: reports } = await query;
  if (!reports?.length) return [];

  const storyIds = reports.filter((r) => r.target_type === "story").map((r) => r.target_id);
  const meetingIds = reports.filter((r) => r.target_type === "meeting").map((r) => r.target_id);
  const uuid = z.uuid();
  const [{ data: stories }, { data: matches }] = await Promise.all([
    storyIds.length
      ? admin.from("stories").select("id, user_id, kind, storage_path, caption").in("id", storyIds.filter((id) => uuid.safeParse(id).success))
      : Promise.resolve({ data: [] as { id: string; user_id: string; kind: "image" | "video"; storage_path: string; caption: string | null }[] }),
    meetingIds.length
      ? admin.from("matches").select("id, user_a, user_b").in("id", meetingIds.filter((id) => uuid.safeParse(id).success))
      : Promise.resolve({ data: [] as { id: string; user_a: string; user_b: string }[] }),
  ]);

  // For meeting reports, the target is the reporter's partner in that meeting.
  const targetUser = (r: (typeof reports)[number]): string | null => {
    if (r.target_type === "user") return uuid.safeParse(r.target_id).success ? r.target_id : null;
    if (r.target_type === "story") return stories?.find((s) => s.id === r.target_id)?.user_id ?? null;
    const m = matches?.find((x) => x.id === r.target_id);
    return m ? (m.user_a === r.reporter_id ? m.user_b : m.user_a) : null;
  };

  const ids = [...new Set(reports.flatMap((r) => [r.reporter_id, targetUser(r)]).filter((x): x is string => !!x))];
  const [{ data: people }, signed] = await Promise.all([
    admin.from("profiles").select("id, name, handle").in("id", ids),
    stories?.length
      ? admin.storage.from("stories").createSignedUrls(stories.map((s) => s.storage_path), 600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const nameOf = (id: string | null) => {
    const p = people?.find((x) => x.id === id);
    return p ? `${p.name} (@${p.handle})` : "Unknown";
  };
  const urlOf = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  return reports.map((r) => {
    const story = stories?.find((s) => s.id === r.target_id);
    const tUser = targetUser(r);
    const src = story ? urlOf.get(story.storage_path) : undefined;
    return {
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      targetName: r.target_type === "user" ? nameOf(tUser) : `${r.target_type} by ${nameOf(tUser)}`,
      targetUserId: tUser,
      reporterName: nameOf(r.reporter_id),
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      storyPreview: story && src ? { kind: story.kind, src, caption: story.caption } : null,
    };
  });
}

const actionSchema = z.object({
  reportId: z.uuid(),
  action: z.enum(["dismissed", "content_hidden", "user_warned", "user_suspended"]),
  note: z.string().trim().max(300).optional(),
});

/** Applies a moderation decision, closes the report, and writes the audit log. */
export async function resolveReport(raw: unknown): Promise<{ ok: true } | Fail> {
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid action" };
  const caller = await requireAdmin();
  if (!caller) return { ok: false, error: "Admins only" };
  const { admin, userId } = caller;
  const { reportId, action, note } = parsed.data;

  const list = await listReports("all");
  const report = list?.find((r) => r.id === reportId);
  if (!report) return { ok: false, error: "Report not found" };
  if (report.status !== "open") return { ok: false, error: "Already resolved" };

  if (action === "content_hidden") {
    if (report.targetType !== "story") return { ok: false, error: "Only stories can be hidden" };
    await admin.from("stories").update({ hidden: true }).eq("id", report.targetId);
  }
  if (action === "user_warned" || action === "user_suspended") {
    if (!report.targetUserId) return { ok: false, error: "No account to act on" };
    if (report.targetUserId === userId) return { ok: false, error: "You can't act on your own account" };
    if (action === "user_suspended") {
      await admin.from("profiles").update({ suspended: true }).eq("id", report.targetUserId);
      await admin.from("match_requests").update({ status: "cancelled" }).eq("user_id", report.targetUserId).eq("status", "open");
      await admin.from("stories").update({ hidden: true }).eq("user_id", report.targetUserId);
    } else {
      await admin.from("notifications").insert({
        user_id: report.targetUserId,
        kind: "moderation_warning",
        payload: { reason: report.reason },
      });
    }
  }

  await admin.from("reports").update({ status: action === "dismissed" ? "dismissed" : "actioned" }).eq("id", reportId);
  await admin.from("moderation_actions").insert({
    report_id: reportId,
    admin_id: userId,
    action,
    target_type: report.targetType,
    target_id: report.targetUserId ?? report.targetId,
    note: note ?? null,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export interface AdminReward {
  id: string;
  sponsorId: string;
  sponsorName: string;
  title: string;
  minStreak: number;
  minPlan: string;
  expiresAt: string;
  available: number;
  claimed: number;
}

export async function listRewardsAdmin(): Promise<{ rewards: AdminReward[]; sponsors: { id: string; name: string }[] } | null> {
  const admin = (await requireAdmin())?.admin;
  if (!admin) return null;
  const [{ data: rewards }, { data: sponsors }, { data: codes }] = await Promise.all([
    admin.from("rewards").select("*").order("min_streak"),
    admin.from("sponsors").select("id, name").order("name"),
    admin.from("reward_codes").select("reward_id, claimed_at"),
  ]);
  return {
    sponsors: sponsors ?? [],
    rewards: (rewards ?? []).map((r) => ({
      id: r.id,
      sponsorId: r.sponsor_id,
      sponsorName: sponsors?.find((s) => s.id === r.sponsor_id)?.name ?? r.sponsor_id,
      title: r.title,
      minStreak: r.min_streak,
      minPlan: r.min_plan,
      expiresAt: r.expires_at,
      available: (codes ?? []).filter((c) => c.reward_id === r.id && !c.claimed_at).length,
      claimed: (codes ?? []).filter((c) => c.reward_id === r.id && c.claimed_at).length,
    })),
  };
}

const codesSchema = z
  .string()
  .transform((s) => [...new Set(s.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean))])
  .pipe(z.array(z.string().regex(/^[A-Za-z0-9-]{4,40}$/, "Codes use letters, numbers and dashes (4–40 characters)")).max(1000));

const rewardSchema = z.object({
  sponsorId: z.string().min(1),
  title: z.string().trim().min(3, "Title is too short").max(60),
  description: z.string().trim().max(200).optional(),
  minStreak: z.coerce.number().int().min(1).max(31),
  minPlan: z.enum(["plus", "premium", "ultra"]),
  expiresAt: z.iso.date("Pick an expiry date"),
  codes: codesSchema,
});

/** Creates a reward with its coupon codes. Codes are stored server-side; stock equals unclaimed codes. */
export async function createReward(raw: unknown): Promise<{ ok: true } | Fail> {
  const parsed = rewardSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reward" };
  const admin = (await requireAdmin())?.admin;
  if (!admin) return { ok: false, error: "Admins only" };
  const { codes, ...r } = parsed.data;
  if (!codes.length) return { ok: false, error: "Add at least one coupon code" };
  const id = `r-${Date.now().toString(36)}`;
  const { error } = await admin.from("rewards").insert({
    id,
    sponsor_id: r.sponsorId,
    title: r.title,
    description: r.description ?? "",
    min_streak: r.minStreak,
    min_plan: r.minPlan,
    expires_at: r.expiresAt,
    stock: codes.length,
  });
  if (error) return { ok: false, error: error.message };
  const { error: codeError } = await admin.from("reward_codes").insert(codes.map((code) => ({ reward_id: id, code })));
  if (codeError) {
    await admin.from("rewards").delete().eq("id", id);
    return { ok: false, error: codeError.message };
  }
  return { ok: true };
}

export async function addRewardCodes(rewardId: string, rawCodes: string): Promise<{ ok: true; added: number } | Fail> {
  const parsed = codesSchema.safeParse(rawCodes);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid codes" };
  const admin = (await requireAdmin())?.admin;
  if (!admin) return { ok: false, error: "Admins only" };
  const { data: inserted, error } = await admin
    .from("reward_codes")
    .upsert(parsed.data.map((code) => ({ reward_id: rewardId, code })), { onConflict: "reward_id,code", ignoreDuplicates: true })
    .select("id");
  if (error) return { ok: false, error: error.message };
  const { count } = await admin.from("reward_codes").select("*", { count: "exact", head: true }).eq("reward_id", rewardId).is("claimed_at", null);
  await admin.from("rewards").update({ stock: count ?? 0 }).eq("id", rewardId);
  return { ok: true, added: inserted?.length ?? 0 };
}
