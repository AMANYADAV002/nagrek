"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addRewardCodes, createReward, listRewardsAdmin, type AdminReward } from "@/lib/actions/admin";
import { getPlan } from "@/lib/config/plans";
import { rewards as seedRewards, sponsorFor, sponsors as seedSponsors } from "@/lib/mock/rewards";
import { backendEnabled } from "@/lib/supabase/env";
import type { PlanId } from "@/lib/types";

const demoSchema = z.object({
  sponsorId: z.string().min(1),
  title: z.string().trim().min(3, "Title is too short").max(60),
  minVisits: z.coerce.number().int().min(1).max(100),
  minPlan: z.enum(["plus", "premium", "ultra"]),
  expiresAt: z.string().min(1, "Pick an expiry date"),
});

const fromSeed = (): AdminReward[] =>
  seedRewards.map((r) => ({
    id: r.id,
    sponsorId: r.sponsorId,
    sponsorName: sponsorFor(r.sponsorId)?.name ?? r.sponsorId,
    title: r.title,
    minVisits: r.minVisits,
    minPlan: r.minPlan,
    expiresAt: r.expiresAt,
    available: r.stock,
    claimed: 0,
  }));

/**
 * Sponsors and rewards. Live: rewards and their coupon codes are saved on the server; codes are
 * never sent back to the browser here, only counts. Demo: changes stay on this page.
 */
export function RewardsAdmin() {
  const live = backendEnabled();
  const [list, setList] = useState<AdminReward[]>(live ? [] : fromSeed());
  const [sponsors, setSponsors] = useState<{ id: string; name: string }[]>(seedSponsors);
  const [form, setForm] = useState({ sponsorId: seedSponsors[0]!.id, title: "", minVisits: "3", minPlan: "plus", expiresAt: "", codes: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [codesFor, setCodesFor] = useState<string | null>(null);
  const [moreCodes, setMoreCodes] = useState("");

  const apply = useCallback((data: Awaited<ReturnType<typeof listRewardsAdmin>>) => {
    if (!data) return;
    setList(data.rewards);
    if (data.sponsors.length) setSponsors(data.sponsors);
  }, []);
  const reload = useCallback(async () => apply(await listRewardsAdmin()), [apply]);

  useEffect(() => {
    if (live) void listRewardsAdmin().then(apply);
  }, [live, apply]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (live) {
      setSaving(true);
      const res = await createReward(form);
      setSaving(false);
      if (!res.ok) return setError(res.error);
      setForm((f) => ({ ...f, title: "", codes: "" }));
      toast.success("Reward added");
      return reload();
    }
    const parsed = demoSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid");
    const sponsorName = sponsors.find((s) => s.id === parsed.data.sponsorId)?.name ?? "";
    setList((l) => [...l, { id: `r-${Date.now()}`, sponsorName, available: 0, claimed: 0, ...parsed.data }]);
    setForm((f) => ({ ...f, title: "" }));
    toast.success("Reward added (this page only)");
  }

  async function saveCodes(rewardId: string) {
    const res = await addRewardCodes(rewardId, moreCodes);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${res.added} code${res.added === 1 ? "" : "s"} added`);
    setCodesFor(null);
    setMoreCodes("");
    await reload();
  }

  const field = "h-10 rounded-xl";
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Partnerships"
        title="Sponsors & rewards"
        description={live ? "Each claim hands out one coupon code. Stock equals unclaimed codes. Codes are never shown here." : "Demo mode: changes are not saved."}
      />

      <GlassCard className="p-5">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
          <select aria-label="Sponsor" value={form.sponsorId} onChange={(e) => setForm({ ...form, sponsorId: e.target.value })} className={`${field} border border-input bg-transparent px-3 text-sm lg:col-span-2`}>
            {sponsors.map((s) => <option key={s.id} value={s.id} className="bg-ink">{s.name}</option>)}
          </select>
          <Input aria-label="Reward title" placeholder="Reward title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${field} lg:col-span-2`} />
          <Input aria-label="Verified visits needed" title="Verified visits needed" type="number" min={1} max={100} value={form.minVisits} onChange={(e) => setForm({ ...form, minVisits: e.target.value })} className={field} />
          <select aria-label="Minimum plan" value={form.minPlan} onChange={(e) => setForm({ ...form, minPlan: e.target.value })} className={`${field} border border-input bg-transparent px-3 text-sm`}>
            {["plus", "premium", "ultra"].map((p) => <option key={p} value={p} className="bg-ink">{p}</option>)}
          </select>
          <Input aria-label="Expires" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={`${field} [color-scheme:dark]`} />
          {live && (
            <Textarea
              aria-label="Coupon codes"
              placeholder="Coupon codes, one per line (or separated by commas)"
              value={form.codes}
              onChange={(e) => setForm({ ...form, codes: e.target.value })}
              className="min-h-20 rounded-xl font-mono text-xs md:col-span-3 lg:col-span-6"
            />
          )}
          <GradientButton type="submit" size="sm" className="h-10" disabled={saving}><Plus /> {saving ? "Saving…" : "Add reward"}</GradientButton>
          {error && <p role="alert" className="text-sm text-red-300 md:col-span-3 lg:col-span-7">{error}</p>}
        </form>
      </GlassCard>

      <GlassCard className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-soft uppercase">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-medium">Reward</th>
              <th className="px-4 py-3 font-medium">Sponsor</th>
              <th className="px-4 py-3 font-medium">Visits</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Codes left</th>
              <th className="px-4 py-3 font-medium">Claimed</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              {live && <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-white/5 align-top last:border-0">
                <td className="px-4 py-3 font-medium">
                  {r.title}
                  {codesFor === r.id && (
                    <div className="mt-2 space-y-2">
                      <Textarea aria-label="More coupon codes" value={moreCodes} onChange={(e) => setMoreCodes(e.target.value)} placeholder="One code per line" className="min-h-20 rounded-xl font-mono text-xs" />
                      <div className="flex gap-2">
                        <GradientButton size="sm" onClick={() => void saveCodes(r.id)}>Save codes</GradientButton>
                        <GradientButton size="sm" variant="ghost" onClick={() => setCodesFor(null)}>Cancel</GradientButton>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-soft">{r.sponsorName}</td>
                <td className="px-4 py-3">{r.minVisits} verified</td>
                <td className="px-4 py-3">{getPlan(r.minPlan as PlanId)?.name ?? r.minPlan}</td>
                <td className="px-4 py-3">{r.available}</td>
                <td className="px-4 py-3">{r.claimed}</td>
                <td className="px-4 py-3 text-soft">{r.expiresAt}</td>
                {live && (
                  <td className="px-4 py-3">
                    {codesFor !== r.id && (
                      <GradientButton size="sm" variant="glass" onClick={() => setCodesFor(r.id)}>Add codes</GradientButton>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
