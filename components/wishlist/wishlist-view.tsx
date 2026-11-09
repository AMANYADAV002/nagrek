"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, Lightbulb, ListChecks, MapPin, Plus, Share2, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Chip } from "@/components/glass/chip";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { EmptyState } from "@/components/glass/states";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uid } from "@/lib/format";
import { addFuturePlan, addWish, deleteWish, shareWish } from "@/lib/actions/account";
import { syncBackend } from "@/lib/db/remote";
import { backendEnabled } from "@/lib/supabase/env";
import { updateSession, useSession, type WishItem } from "@/lib/mock/session";
import { usePeople } from "@/lib/people-client";
import type { MockUser } from "@/lib/types";

const wishSchema = z.object({
  kind: z.enum(["place", "food", "idea"]),
  title: z.string().trim().min(2, "Give it a name").max(60),
  note: z.string().trim().max(140).optional(),
});

const planSchema = z.object({
  title: z.string().trim().min(2).max(60),
  date: z.string().min(1, "Pick a date").refine((d) => new Date(d) > new Date(), "Pick a future date"),
  place: z.string().trim().min(2, "Where?").max(80),
  invitees: z.array(z.string()).min(1, "Invite at least one connection"),
});

const kindIcon = { place: MapPin, food: Utensils, idea: Lightbulb } as const;

/** TODO(phase-2): `wishlist_items` + `plans_future` tables with RLS (owner + shared connections). */
export function WishlistView() {
  const session = useSession();
  const [kind, setKind] = useState<WishItem["kind"]>("place");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<WishItem | null>(null);
  const [shareFor, setShareFor] = useState<WishItem | null>(null);

  const people = usePeople(
    session
      ? [...new Set([...Object.keys(session.connections), ...session.wishlist.flatMap((w) => w.sharedWith), ...session.futurePlans.flatMap((p) => p.invitees)])]
      : [],
  );
  if (!session) return null;
  const friends = people.filter((u) => session.connections[u.id] === "accepted");
  const firstName = (id: string) => people.find((u) => u.id === id)?.name.split(" ")[0] ?? "a friend";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = wishSchema.safeParse({ kind, title, note: note || undefined });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid");
    setError(null);
    const localId = uid("w");
    updateSession((s) => ({ wishlist: [{ id: localId, ...parsed.data, sharedWith: [], createdAt: new Date().toISOString() }, ...s.wishlist] }));
    setTitle("");
    setNote("");
    if (!backendEnabled()) return;
    const saved = await addWish(parsed.data);
    if (!saved.ok) return toast.error(saved.error ?? "Could not save");
    if (saved.id) updateSession((s) => ({ wishlist: s.wishlist.map((w) => (w.id === localId ? { ...w, id: saved.id! } : w)) }));
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Future plans" title={<>Your <span className="text-brand">wish list</span></>} description="Places, dishes and ideas you want to try. Share them with connections and turn them into a meetup." />

      <GlassCard className="p-5">
        <form onSubmit={add} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["place", "food", "idea"] as const).map((k) => (
              <Chip key={k} selected={kind === k} onClick={() => setKind(k)} className="capitalize">{k}</Chip>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rooftop momos in Hauz Khas" aria-label="Title" className="h-11 rounded-xl" maxLength={60} />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className="h-11 rounded-xl" maxLength={140} />
            <GradientButton type="submit"><Plus /> Add</GradientButton>
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </form>
      </GlassCard>

      {session.futurePlans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Upcoming plans</h2>
          {session.futurePlans.map((p) => (
            <GlassCard key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <CalendarPlus className="size-5 text-peach" aria-hidden />
              <div className="flex-1">
                <p className="font-semibold">{p.title}</p>
                <p className="text-xs text-soft">
                  {new Date(p.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {p.place} · with {p.invitees.map(firstName).join(", ")}
                </p>
              </div>
              <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-200">Invite pending</span>
            </GlassCard>
          ))}
        </section>
      )}

      {session.wishlist.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-8" />} title="Your wish list is empty" description="Add a place or a dish you have been meaning to try." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {session.wishlist.map((w) => {
              const Icon = kindIcon[w.kind];
              return (
                <motion.li key={w.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <GlassCard className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-peach"><Icon className="size-4" aria-hidden /></span>
                      <div className="flex-1">
                        <p className="font-semibold">{w.title}</p>
                        {w.note && <p className="text-sm text-soft">{w.note}</p>}
                        {w.sharedWith.length > 0 && (
                          <p className="mt-1 text-xs text-peach">Shared with {w.sharedWith.map(firstName).join(", ")}</p>
                        )}
                      </div>
                      <button type="button" aria-label={`Delete ${w.title}`} onClick={() => { updateSession((s) => ({ wishlist: s.wishlist.filter((x) => x.id !== w.id) })); syncBackend(() => deleteWish(w.id)); }} className="grid size-8 place-items-center rounded-full text-soft hover:bg-white/10 hover:text-red-300">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex gap-2">
                      <GradientButton size="sm" variant="glass" onClick={() => setShareFor(w)}><Share2 /> Share</GradientButton>
                      <GradientButton size="sm" onClick={() => setPlanFor(w)}><CalendarPlus /> Propose meetup</GradientButton>
                    </div>
                  </GlassCard>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <ShareDialog item={shareFor} friends={friends} onClose={() => setShareFor(null)} />
      <PlanDialog item={planFor} friends={friends} onClose={() => setPlanFor(null)} />
    </div>
  );
}

type Friend = MockUser;

function ShareDialog({ item, friends, onClose }: { item: WishItem | null; friends: Friend[]; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-7 sm:max-w-md">
        <DialogTitle className="text-xl">Share “{item?.title}”</DialogTitle>
        <DialogDescription>Only accepted connections can see shared items.</DialogDescription>
        {friends.length === 0 ? (
          <p className="text-sm text-soft">No connections yet. Accept a request on the People tab first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => (
              <Chip key={f.id} selected={picked.includes(f.id)} onClick={() => setPicked((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))}>
                {f.name}
              </Chip>
            ))}
          </div>
        )}
        <GradientButton
          disabled={!picked.length}
          onClick={() => {
            if (!item) return;
            updateSession((s) => ({ wishlist: s.wishlist.map((w) => (w.id === item.id ? { ...w, sharedWith: [...new Set([...w.sharedWith, ...picked])] } : w)) }));
            syncBackend(() => shareWish(item.id, picked));
            toast.success("Shared!");
            setPicked([]);
            onClose();
          }}
        >
          Share
        </GradientButton>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ item, friends, onClose }: { item: WishItem | null; friends: Friend[]; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!item) return;
    const parsed = planSchema.safeParse({ title: item.title, date, place: place || (item.kind === "place" ? item.title : ""), invitees });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid plan");
    // TODO(phase-2): insert into `plans_future` and notify invitees.
    updateSession((s) => ({ futurePlans: [...s.futurePlans, { id: uid("fp"), wishId: item.id, ...parsed.data }] }));
    syncBackend(() => addFuturePlan({ wishId: item.id, ...parsed.data }));
    toast.success("Meetup proposed! Invites sent.");
    setDate("");
    setPlace("");
    setInvitees([]);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-7 sm:max-w-md">
        <DialogTitle className="text-xl">Propose a meetup</DialogTitle>
        <DialogDescription>{item?.title}</DialogDescription>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-date" className="text-xs text-soft">Date and time</Label>
            <Input id="plan-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl [color-scheme:dark]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-place" className="text-xs text-soft">Place</Label>
            <Input id="plan-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={item?.kind === "place" ? item.title : "Where should you meet?"} className="h-11 rounded-xl" />
          </div>
          <div>
            <p className="mb-2 text-xs text-soft">Invite</p>
            {friends.length === 0 ? (
              <p className="text-sm text-soft">No connections yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {friends.map((f) => (
                  <Chip key={f.id} selected={invitees.includes(f.id)} onClick={() => setInvitees((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))}>
                    {f.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <GradientButton className="w-full" onClick={submit}>Send invite</GradientButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
