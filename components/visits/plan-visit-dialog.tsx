"use client";

import { useState } from "react";
import { CalendarPlus, Utensils } from "lucide-react";
import { toast } from "sonner";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { proposeVisit } from "@/lib/actions/visits";
import { restaurantHref } from "@/lib/places/query";

/** `datetime-local` value for a time in the browser's timezone. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Plan an in-person visit with one connection, optionally linked to the call it was planned on. */
export function PlanVisitDialog({
  open,
  onOpenChange,
  people,
  defaultPersonId,
  callId,
  craving,
  onPlanned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: { id: string; name: string }[];
  defaultPersonId?: string;
  callId?: string;
  /** Shared craving for this match, used to pre-select restaurant filters. */
  craving?: string | null;
  onPlanned?: () => void;
}) {
  const [personId, setPersonId] = useState(defaultPersonId ?? "");
  const [place, setPlace] = useState("");
  const [area, setArea] = useState("");
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 24 * 3_600_000)));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const chosen = personId || defaultPersonId || people[0]?.id || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) return setError("Pick a date and time");
    setSaving(true);
    const res = await proposeVisit({
      inviteeId: chosen,
      placeName: place,
      placeArea: area || undefined,
      note: note || undefined,
      scheduledAt: at.toISOString(),
      callId,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success("Visit planned. We'll let them know.");
    setPlace("");
    setArea("");
    setNote("");
    onOpenChange(false);
    onPlanned?.();
  }

  const field = "h-11 rounded-xl";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-7 sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarPlus className="size-5 text-peach" aria-hidden /> Plan a visit
            </DialogTitle>
            <DialogDescription>Meet in a public place. When you&apos;re there, scan each other&apos;s code to verify the visit and grow your streak.</DialogDescription>
          </div>
          {people.length > 1 || !defaultPersonId ? (
            <select
              aria-label="Who"
              value={chosen}
              onChange={(e) => setPersonId(e.target.value)}
              className={`${field} w-full border border-input bg-transparent px-3 text-sm`}
            >
              {people.length === 0 && <option value="">Connect with someone first</option>}
              {people.map((p) => <option key={p.id} value={p.id} className="bg-ink">{p.name}</option>)}
            </select>
          ) : (
            <p className="text-sm">With <span className="font-semibold">{people[0]?.name}</span></p>
          )}
          {!place.trim() && chosen && (
            <GradientLink href={restaurantHref({ withId: chosen, name: people.find((p) => p.id === chosen)?.name, food: craving })}>
              <Utensils className="size-4" /> Select a Restaurant
            </GradientLink>
          )}
          <Input aria-label="Place" placeholder="Place (e.g. Third Wave Coffee)" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} className={field} required />
          <Input aria-label="Area" placeholder="Area (optional, e.g. Indiranagar)" value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} className={field} />
          <Input aria-label="Date and time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} [color-scheme:dark]`} required />
          <Textarea aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="min-h-20 rounded-xl" />
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <GradientButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</GradientButton>
            <GradientButton type="submit" disabled={saving || !chosen}>{saving ? "Saving…" : "Send plan"}</GradientButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
