"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Flame, Lock, RotateCcw, Save, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  avatarCategories, avatarItems, backgrounds, hairColors, itemKey, outfitColors, skinTones,
  type AvatarCategory, type AvatarItem,
} from "@/lib/config/avatar-items";
import { saveAvatar } from "@/lib/actions/account";
import { formatInr } from "@/lib/config/plans";
import { updateSession, useSession } from "@/lib/mock/session";
import { runCheckout } from "@/lib/payments/checkout-client";
import { freePreview } from "@/lib/payments/mode";
import { backendEnabled } from "@/lib/supabase/env";
import { calculateStreak } from "@/lib/streak/calc";
import type { AvatarConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

function swatch(item: AvatarItem): string | undefined {
  if (item.category === "skin") return skinTones[item.id];
  if (item.category === "hairColor") return hairColors[item.id];
  if (item.category === "outfit") return outfitColors[item.id];
  if (item.category === "background") {
    const [a, b] = backgrounds[item.id] ?? [];
    return a ? `linear-gradient(135deg, ${a}, ${b})` : undefined;
  }
  return undefined;
}

/** Layered avatar builder. Paid items are one-time ₹ purchases through Razorpay; the database re-checks on save. */
export function AvatarBuilder() {
  const session = useSession();
  const [draft, setDraft] = useState<AvatarConfig | null>(null);
  const [category, setCategory] = useState<AvatarCategory>("hair");
  const [buying, setBuying] = useState<AvatarItem | null>(null);
  const [paying, setPaying] = useState(false);
  if (!session) return null;

  const config = draft ?? session.avatar;
  const streak = calculateStreak(session.streakEvents);

  function status(item: AvatarItem): { usable: boolean; label?: string; kind?: "price" | "streak" | "plan" } {
    if (item.unlock?.type === "streak") {
      return streak >= item.unlock.days ? { usable: true } : { usable: false, label: `${item.unlock.days}-day streak`, kind: "streak" };
    }
    if (item.unlock?.type === "plan") {
      return session!.plan === "ultra" ? { usable: true } : { usable: false, label: "Ultra", kind: "plan" };
    }
    if (item.priceInr > 0 && !session!.ownedItems.includes(itemKey(item))) {
      return { usable: false, label: formatInr(item.priceInr), kind: "price" };
    }
    return { usable: true };
  }

  function pick(item: AvatarItem) {
    const s = status(item);
    if (s.usable) return setDraft({ ...config, [item.category]: item.id });
    if (s.kind === "price") return setBuying(item);
    toast.message(s.kind === "streak" ? `Reach a ${s.label} to unlock this.` : "This item is exclusive to Ultra.");
  }

  async function buy() {
    if (!buying) return;
    const item = buying;
    setPaying(true);
    if (backendEnabled()) {
      // Razorpay opens its own window; our dialog would trap focus away from it.
      setBuying(null);
      const result = await runCheckout({ kind: "avatar_item", category: item.category, itemId: item.id });
      setPaying(false);
      if (!result.ok) {
        if (result.cancelled) toast.message("Payment cancelled. Nothing was charged.");
        else toast.error(result.error);
        return;
      }
    } else {
      await new Promise((r) => setTimeout(r, 900));
      setPaying(false);
      setBuying(null);
    }
    updateSession((s) => ({ ownedItems: [...s.ownedItems, itemKey(item)] }));
    setDraft({ ...config, [item.category]: item.id });
    toast.success(`${item.label} unlocked`);
  }

  async function save() {
    if (backendEnabled()) {
      const saved = await saveAvatar(config);
      if (!saved.ok) return toast.error(saved.error);
    }
    updateSession({ avatar: config });
    setDraft(null);
    toast.success("Avatar saved");
  }

  const items = avatarItems.filter((i) => i.category === category);
  const dirty = draft && JSON.stringify(draft) !== JSON.stringify(session.avatar);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Avatar studio" title={<>Make it <span className="text-brand">yours</span></>} description="Basic items are free. Premium items are one-time purchases, and some unlock with your streak or the Ultra plan." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_1.3fr]">
        <GlassCard strong className="flex flex-col items-center gap-6 p-8 lg:sticky lg:top-8 lg:self-start">
          <motion.div key={JSON.stringify(config)} initial={{ scale: 0.94, rotate: -2 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="size-56 md:size-64">
            <LayeredAvatar config={config} title="Your avatar preview" />
          </motion.div>
          <div className="flex gap-2">
            <GradientButton variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={!dirty}>
              <RotateCcw /> Reset
            </GradientButton>
            <GradientButton
              size="sm"
              disabled={!dirty}
              onClick={save}
            >
              <Save /> Save avatar
            </GradientButton>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <div role="tablist" aria-label="Avatar layers" className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1">
            {avatarCategories.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn("relative shrink-0 rounded-full px-4 py-2 text-sm", category === c.id ? "text-ink" : "text-soft hover:text-cream")}
              >
                {category === c.id && <motion.span layoutId="avatar-tab" className="absolute inset-0 rounded-full bg-brand" />}
                <span className="relative">{c.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {items.map((item) => {
              const s = status(item);
              const selected = config[item.category] === item.id;
              const sw = swatch(item);
              const preview: AvatarConfig = { ...config, [item.category]: item.id };
              return (
                <button
                  key={itemKey(item)}
                  type="button"
                  onClick={() => pick(item)}
                  aria-pressed={selected}
                  aria-label={`${item.label}${s.label ? `, locked: ${s.label}` : ""}`}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs transition-all hover:-translate-y-0.5",
                    selected ? "border-peach bg-peach/10" : "border-white/10 bg-white/[0.03] hover:border-white/25",
                  )}
                >
                  {sw ? (
                    <span className="size-14 rounded-full border border-white/20" style={{ background: sw }} />
                  ) : (
                    <span className="size-14"><LayeredAvatar config={preview} /></span>
                  )}
                  <span className="truncate">{item.label}</span>
                  {selected && <Check className="absolute top-2 right-2 size-3.5 text-peach" aria-hidden />}
                  {!s.usable && (
                    <span className="absolute inset-x-2 top-2 flex items-center justify-center gap-1 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] text-peach">
                      {s.kind === "price" ? <ShoppingBag className="size-3" /> : s.kind === "streak" ? <Flame className="size-3" /> : <Crown className="size-3" />}
                      {s.label}
                    </span>
                  )}
                  {!s.usable && <Lock className="absolute right-2 bottom-2 size-3 text-white/40" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!buying} onOpenChange={(o) => !o && !paying && setBuying(null)}>
        <DialogContent className="glass-strong max-w-sm rounded-3xl border-0 p-7 sm:max-w-sm">
          {buying && (
            <div className="space-y-4 text-center">
              <div className="mx-auto size-32">
                <LayeredAvatar config={{ ...config, [buying.category]: buying.id }} />
              </div>
              <DialogTitle className="text-xl">Unlock {buying.label}</DialogTitle>
              <DialogDescription>
                {freePreview()
                  ? `Free during preview (normally ${formatInr(buying.priceInr)})`
                  : `One-time purchase · ${formatInr(buying.priceInr)}${backendEnabled() ? " · paid securely with Razorpay" : " (demo, no real money)"}`}
              </DialogDescription>
              <GradientButton className="w-full" onClick={buy} disabled={paying}>
                <ShoppingBag /> {paying ? "Processing…" : freePreview() ? "Unlock free" : `Pay ${formatInr(buying.priceInr)}`}
              </GradientButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
