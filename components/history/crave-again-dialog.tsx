"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GradientButton } from "@/components/glass/gradient-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { sendCravingInvite } from "@/lib/actions/history";
import { cuisineChips, cravingEmoji } from "@/lib/data/cravings";

const vibes = ["Casual", "Professional", "Any tone"];

/** A short craving aimed at one person from History. They can accept or decline. */
export function CraveAgainDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
  onSent?: () => void;
}) {
  const [food, setFood] = useState("");
  const [custom, setCustom] = useState("");
  const [vibe, setVibe] = useState("Casual");
  const [saving, setSaving] = useState(false);
  const first = partnerName.split(" ")[0];
  const chosen = (custom.trim() || food).slice(0, 40);

  async function send() {
    if (!chosen) return toast.error("Pick what you want to eat.");
    setSaving(true);
    const res = await sendCravingInvite(partnerId, chosen, vibe);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Request sent to ${first}.`);
    onOpenChange(false);
    onSent?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Crave again with {first}</DialogTitle>
        <DialogDescription>They can accept or decline. Your chat stays either way.</DialogDescription>
        <div className="flex flex-wrap gap-2">
          {cuisineChips.map((chip) => (
            <button
              key={chip}
              type="button"
              aria-pressed={food === chip && !custom}
              onClick={() => {
                setFood(chip);
                setCustom("");
              }}
              className={`rounded-full px-3 py-1.5 text-sm ${food === chip && !custom ? "bg-brand text-ink" : "bg-white/10 text-cream"}`}
            >
              {cravingEmoji[chip] ?? "🍽️"} {chip}
            </button>
          ))}
        </div>
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Or type a craving" maxLength={40} aria-label="Craving" />
        <div className="flex gap-2">
          {vibes.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={vibe === item}
              onClick={() => setVibe(item)}
              className={`rounded-full px-3 py-1.5 text-xs ${vibe === item ? "bg-white/15 text-cream" : "text-soft"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <GradientButton disabled={saving || !chosen} onClick={() => void send()}>
          {saving ? "Sending…" : `Send ${chosen || "request"}`}
        </GradientButton>
      </DialogContent>
    </Dialog>
  );
}
