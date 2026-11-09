"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, Check, MapPin, MapPinCheck, X } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { EmptyState } from "@/components/glass/states";
import { PlanVisitDialog } from "@/components/visits/plan-visit-dialog";
import { VerifyButton, VerifyVisitDialog } from "@/components/visits/verify-visit";
import { cancelVisit, loadVisits, respondVisit, type VisitStreak, type VisitView } from "@/lib/actions/visits";
import { useSession } from "@/lib/mock/session";
import { usePeople } from "@/lib/people-client";
import { backendEnabled } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

const statusText: Record<VisitView["status"], string> = {
  proposed: "Waiting for a reply",
  accepted: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  verified: "Verified in person",
  expired: "Expired without verification",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Planned in-person visits and the QR + GPS verification that grows the visit streak. */
export function VisitsView({ withId }: { withId?: string }) {
  const session = useSession();
  const live = backendEnabled();
  const [data, setData] = useState<{ visits: VisitView[]; streak: VisitStreak } | null>(null);
  const [planOpen, setPlanOpen] = useState(!!withId);
  const [verifying, setVerifying] = useState<VisitView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const friendIds = session ? Object.entries(session.connections).filter(([, s]) => s === "accepted").map(([id]) => id) : [];
  const friends = usePeople(friendIds).filter((p) => !session?.blocked.includes(p.id));

  const reload = useCallback(async () => setData(await loadVisits()), []);
  useEffect(() => {
    if (live) void loadVisits().then(setData);
  }, [live]);

  if (!session) return null;

  const header = (
    <PageHeader
      eyebrow="Meet in person"
      title={<>Your <span className="text-brand">visits</span></>}
      description="Plan a visit with a connection. When you meet, scan each other's code to verify it. Verified visits grow your visit streak and unlock sponsor rewards for both of you."
    />
  );

  if (!live) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={<MapPinCheck className="size-8" />} title="Available with a live account" description="Visit planning and in-person verification need a signed-in Nagrek account." />
      </div>
    );
  }

  async function act(id: string, run: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setBusy(id);
    const res = await run();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(success);
    await reload();
  }

  const visits = data?.visits ?? [];
  const groups: { title: string; list: VisitView[] }[] = [
    { title: "Needs your answer", list: visits.filter((v) => v.status === "proposed" && !v.iProposed) },
    { title: "Upcoming", list: visits.filter((v) => v.status === "accepted").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) },
    { title: "Waiting for them", list: visits.filter((v) => v.status === "proposed" && v.iProposed) },
    { title: "Past", list: visits.filter((v) => !["proposed", "accepted"].includes(v.status)) },
  ];

  return (
    <div className="space-y-6">
      {header}

      <GlassCard strong className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span className="grid size-20 shrink-0 place-items-center rounded-3xl bg-brand font-heading text-4xl font-bold text-ink">{data?.streak.current ?? 0}</span>
        <div className="flex-1 space-y-1">
          <p className="text-lg font-medium">Visit streak</p>
          <p className="text-sm text-soft">
            Best {data?.streak.best ?? 0} · {data?.streak.totalVerified ?? 0} verified in total. One counted visit per person per week, up to two a day. The streak resets after 30 days without a verified visit.
          </p>
        </div>
        <GradientButton onClick={() => setPlanOpen(true)} disabled={!friends.length}><CalendarPlus /> Plan a visit</GradientButton>
      </GlassCard>

      {!data ? (
        <p className="text-sm text-soft">Loading your visits…</p>
      ) : visits.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-8" />}
          title="No visits yet"
          description={friends.length ? "Plan one with a connection, or from a call." : "Connect with someone first, then plan a visit together."}
        />
      ) : (
        groups.filter((g) => g.list.length).map((g) => (
          <section key={g.title} className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-soft uppercase">{g.title}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {g.list.map((v) => (
                <li key={v.id}>
                  <GlassCard className={cn("flex h-full flex-col gap-3 p-4", v.canVerify && "ring-1 ring-peach/50")}>
                    <div className="flex items-center gap-3">
                      <span className="size-12 shrink-0 overflow-hidden rounded-full">
                        <LayeredAvatar config={v.partner.avatar} title={v.partner.name} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{v.partner.name}</p>
                        <p className={cn("text-xs", v.status === "verified" ? "text-green-300" : "text-soft")}>{statusText[v.status]}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-1.5"><MapPin className="size-4 text-peach" aria-hidden /> {v.placeName}{v.placeArea ? `, ${v.placeArea}` : ""}</p>
                      <p className="flex items-center gap-1.5 text-soft"><CalendarClock className="size-4" aria-hidden /> {when(v.scheduledAt)}</p>
                      {v.note && <p className="text-soft">“{v.note}”</p>}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      {v.status === "proposed" && !v.iProposed && (
                        <>
                          <GradientButton size="sm" variant="ghost" disabled={busy === v.id} onClick={() => void act(v.id, () => respondVisit(v.id, false), "Declined")}><X /> Decline</GradientButton>
                          <GradientButton size="sm" disabled={busy === v.id} onClick={() => void act(v.id, () => respondVisit(v.id, true), "Visit confirmed")}><Check /> Accept</GradientButton>
                        </>
                      )}
                      {v.status === "accepted" && (
                        v.canVerify
                          ? <VerifyButton onClick={() => setVerifying(v)} />
                          : <p className="text-xs text-soft">Verification opens 2 hours before.</p>
                      )}
                      {(v.status === "proposed" || v.status === "accepted") && (
                        <GradientButton size="sm" variant="ghost" disabled={busy === v.id} onClick={() => void act(v.id, () => cancelVisit(v.id), "Plan cancelled")}>Cancel plan</GradientButton>
                      )}
                    </div>
                  </GlassCard>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <PlanVisitDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        people={friends.map((f) => ({ id: f.id, name: f.name }))}
        defaultPersonId={withId && friends.some((f) => f.id === withId) ? withId : undefined}
        onPlanned={() => void reload()}
      />
      {verifying && (
        <VerifyVisitDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setVerifying(null);
              void reload();
            }
          }}
          visitId={verifying.id}
          partnerName={verifying.partner.name}
          onVerified={() => void reload()}
        />
      )}
    </div>
  );
}
