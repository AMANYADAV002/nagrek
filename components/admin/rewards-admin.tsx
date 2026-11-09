"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { Input } from "@/components/ui/input";
import { getPlan } from "@/lib/config/plans";
import { rewards as seedRewards, sponsorFor, sponsors, type Reward } from "@/lib/mock/rewards";

const rewardSchema = z.object({
  sponsorId: z.string().min(1),
  title: z.string().trim().min(3, "Title is too short").max(60),
  minStreak: z.coerce.number().int().min(1).max(31),
  minPlan: z.enum(["plus", "premium", "ultra"]),
  stock: z.coerce.number().int().min(1, "Stock must be at least 1"),
  expiresAt: z.string().min(1, "Pick an expiry date"),
});

/**
 * Sponsor + reward management stub.
 * TODO(phase-6): coupon codes are uploaded here and stored server-side only; never sent to clients until a claim is approved.
 */
export function RewardsAdmin() {
  const [list, setList] = useState<Reward[]>(seedRewards);
  const [form, setForm] = useState({ sponsorId: sponsors[0]!.id, title: "", minStreak: "7", minPlan: "plus", stock: "50", expiresAt: "" });
  const [error, setError] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = rewardSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid");
    setError(null);
    setList((l) => [...l, { id: `r-${Date.now()}`, description: "", ...parsed.data }]);
    setForm((f) => ({ ...f, title: "" }));
    toast.success("Reward added (local only)");
  }

  const field = "h-10 rounded-xl";
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Partnerships" title="Sponsors & rewards" description="Streak rewards shown on the Streak page. Coupon codes are not managed in Phase 1." />

      <GlassCard className="p-5">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
          <select aria-label="Sponsor" value={form.sponsorId} onChange={(e) => setForm({ ...form, sponsorId: e.target.value })} className={`${field} border border-input bg-transparent px-3 text-sm lg:col-span-2`}>
            {sponsors.map((s) => <option key={s.id} value={s.id} className="bg-ink">{s.name}</option>)}
          </select>
          <Input aria-label="Reward title" placeholder="Reward title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${field} lg:col-span-2`} />
          <Input aria-label="Minimum streak (days)" type="number" min={1} max={31} value={form.minStreak} onChange={(e) => setForm({ ...form, minStreak: e.target.value })} className={field} />
          <select aria-label="Minimum plan" value={form.minPlan} onChange={(e) => setForm({ ...form, minPlan: e.target.value })} className={`${field} border border-input bg-transparent px-3 text-sm`}>
            {["plus", "premium", "ultra"].map((p) => <option key={p} value={p} className="bg-ink">{p}</option>)}
          </select>
          <Input aria-label="Stock" type="number" min={1} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={field} />
          <Input aria-label="Expires" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={`${field} [color-scheme:dark] lg:col-span-2`} />
          <GradientButton type="submit" size="sm" className="h-10"><Plus /> Add reward</GradientButton>
          {error && <p role="alert" className="text-sm text-red-300 md:col-span-3 lg:col-span-7">{error}</p>}
        </form>
      </GlassCard>

      <GlassCard className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-soft uppercase">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-medium">Reward</th>
              <th className="px-4 py-3 font-medium">Sponsor</th>
              <th className="px-4 py-3 font-medium">Streak</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Expires</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-medium">{r.title}</td>
                <td className="px-4 py-3 text-soft">{sponsorFor(r.sponsorId)?.name}</td>
                <td className="px-4 py-3">{r.minStreak} days</td>
                <td className="px-4 py-3">{getPlan(r.minPlan)?.name ?? r.minPlan}</td>
                <td className="px-4 py-3">{r.stock}</td>
                <td className="px-4 py-3 text-soft">{r.expiresAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
