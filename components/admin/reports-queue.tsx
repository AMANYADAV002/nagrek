"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { EmptyState } from "@/components/glass/states";
import { listReports, resolveReport, type AdminReport } from "@/lib/actions/admin";
import { timeAgo } from "@/lib/format";
import { useSession, type ReportRecord } from "@/lib/mock/session";
import { getMockUser } from "@/lib/mock/users";
import { backendEnabled } from "@/lib/supabase/env";

const seedQueue: ReportRecord[] = [
  { id: "seed-1", targetType: "user", targetId: "u-kabir", reason: "Harassment", details: "Kept asking for my number after I said no.", createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { id: "seed-2", targetType: "story", targetId: "s-dev-1", reason: "Spam", createdAt: new Date(Date.now() - 26 * 3600_000).toISOString() },
];

type Action = "dismissed" | "content_hidden" | "user_warned" | "user_suspended";

interface Row {
  id: string;
  targetType: ReportRecord["targetType"];
  target: string;
  reporter?: string;
  reason: string;
  details?: string | null;
  createdAt: string;
  status: string;
  canActOnUser: boolean;
  preview?: AdminReport["storyPreview"];
}

/** Live: every open report, from the server (admins only). Demo: your own reports plus two samples. */
export function ReportsQueue() {
  const session = useSession();
  const live = backendEnabled();
  const [resolved, setResolved] = useState<Record<string, Action>>({});
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setReports(await listReports(showAll ? "all" : "open"));
  }, [showAll]);

  useEffect(() => {
    if (live) void listReports(showAll ? "all" : "open").then(setReports);
  }, [live, showAll]);

  if (!session) return null;

  const rows: Row[] = live
    ? (reports ?? []).map((r) => ({
        id: r.id,
        targetType: r.targetType,
        target: r.targetName,
        reporter: r.reporterName,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        status: r.status,
        canActOnUser: !!r.targetUserId,
        preview: r.storyPreview,
      }))
    : [...session.reports, ...seedQueue].map((r) => ({
        id: r.id,
        targetType: r.targetType,
        target: r.targetType === "user" ? (getMockUser(r.targetId)?.name ?? r.targetId) : r.targetId,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        status: resolved[r.id] ? "actioned" : "open",
        canActOnUser: true,
      }));

  async function act(id: string, a: Action) {
    if (a === "user_suspended" && !window.confirm("Suspend this account? They will be signed out of matching and their stories hidden.")) return;
    if (!live) {
      setResolved((r) => ({ ...r, [id]: a }));
      toast.success(`Report ${a.replace("_", " ")}`);
      return;
    }
    setBusy(id);
    const res = await resolveReport({ reportId: id, action: a });
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Report ${a.replace("_", " ")}`);
    await reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Moderation"
        title="Reports queue"
        description={live ? "Every decision is saved to the audit log." : "Your own submitted reports appear here too, so you can test the full loop."}
        action={
          live && (
            <GradientButton size="sm" variant="glass" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Open only" : "Show resolved"}
            </GradientButton>
          )
        }
      />
      {live && reports === null ? (
        <p className="text-sm text-soft">Loading reports…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Queue is empty" />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const done = live ? r.status !== "open" && r.status : resolved[r.id];
            return (
              <GlassCard key={r.id} className="flex flex-wrap items-center gap-4 p-4">
                {r.preview &&
                  (r.preview.kind === "video" ? (
                    <video src={r.preview.src} muted controls className="h-28 w-20 rounded-xl object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.preview.src} alt={r.preview.caption ?? "Reported story"} className="h-28 w-20 rounded-xl object-cover" />
                  ))}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="mr-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase">{r.targetType}</span>
                    {r.target} · <span className="text-peach">{r.reason}</span>
                  </p>
                  {r.details && <p className="mt-1 text-sm text-soft">“{r.details}”</p>}
                  <p className="mt-1 text-xs text-soft">
                    {timeAgo(r.createdAt)}
                    {r.reporter && <> · reported by {r.reporter}</>}
                  </p>
                </div>
                {done ? (
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-200">{String(done).replace("_", " ")}</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <GradientButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => void act(r.id, "dismissed")}>Dismiss</GradientButton>
                    {r.targetType === "story" && (
                      <GradientButton size="sm" variant="glass" disabled={busy === r.id} onClick={() => void act(r.id, "content_hidden")}>Hide story</GradientButton>
                    )}
                    {r.canActOnUser && (
                      <>
                        <GradientButton size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r.id, "user_warned")}>Warn</GradientButton>
                        <GradientButton size="sm" variant="danger" disabled={busy === r.id} onClick={() => void act(r.id, "user_suspended")}>Suspend</GradientButton>
                      </>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
