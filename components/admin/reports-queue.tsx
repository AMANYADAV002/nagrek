"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { EmptyState } from "@/components/glass/states";
import { timeAgo } from "@/lib/format";
import { useSession, type ReportRecord } from "@/lib/mock/session";
import { getMockUser } from "@/lib/mock/users";

const seedQueue: ReportRecord[] = [
  { id: "seed-1", targetType: "user", targetId: "u-kabir", reason: "Harassment", details: "Kept asking for my number after I said no.", createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { id: "seed-2", targetType: "story", targetId: "s-dev-1", reason: "Spam", createdAt: new Date(Date.now() - 26 * 3600_000).toISOString() },
];

type Action = "dismissed" | "content_hidden" | "user_warned" | "user_suspended";

/** TODO(phase-7): read `reports` with service role on the server; actions write to `moderation_actions` + audit log. */
export function ReportsQueue() {
  const session = useSession();
  const [resolved, setResolved] = useState<Record<string, Action>>({});
  if (!session) return null;
  const queue = [...session.reports, ...seedQueue];

  const act = (id: string, a: Action) => {
    setResolved((r) => ({ ...r, [id]: a }));
    toast.success(`Report ${a.replace("_", " ")}`);
  };

  return (
    <div>
      <PageHeader eyebrow="Moderation" title="Reports queue" description="Your own submitted reports appear here too, so you can test the full loop." />
      {queue.length === 0 ? (
        <EmptyState title="Queue is empty" />
      ) : (
        <div className="space-y-3">
          {queue.map((r) => {
            const target = r.targetType === "user" ? getMockUser(r.targetId)?.name ?? r.targetId : r.targetId;
            const done = resolved[r.id];
            return (
              <GlassCard key={r.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="mr-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase">{r.targetType}</span>
                    {target} · <span className="text-peach">{r.reason}</span>
                  </p>
                  {r.details && <p className="mt-1 text-sm text-soft">“{r.details}”</p>}
                  <p className="mt-1 text-xs text-soft">{timeAgo(r.createdAt)}</p>
                </div>
                {done ? (
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-200">{done.replace("_", " ")}</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <GradientButton size="sm" variant="ghost" onClick={() => act(r.id, "dismissed")}>Dismiss</GradientButton>
                    {r.targetType !== "user" && <GradientButton size="sm" variant="glass" onClick={() => act(r.id, "content_hidden")}>Hide content</GradientButton>}
                    <GradientButton size="sm" variant="outline" onClick={() => act(r.id, "user_warned")}>Warn</GradientButton>
                    <GradientButton size="sm" variant="danger" onClick={() => act(r.id, "user_suspended")}>Suspend</GradientButton>
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
