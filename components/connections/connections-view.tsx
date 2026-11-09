"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Check, CalendarPlus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { EmptyState } from "@/components/glass/states";
import { toneLabel } from "@/lib/format";
import { cancelConnection, respondConnection, sendConnection, setBlock, setFollow } from "@/lib/actions/account";
import { syncBackend } from "@/lib/db/remote";
import { updateSession, useSession } from "@/lib/mock/session";
import { useDiscover, usePeople } from "@/lib/people-client";
import type { MockUser } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "requests" | "friends" | "sent" | "discover" | "blocked";

/** Follows, connections and blocks. Live mode reads real people; demo mode uses the built-in ones. */
export function ConnectionsView() {
  const session = useSession();
  const [tab, setTab] = useState<Tab>("requests");
  const known = usePeople(session ? [...new Set([...Object.keys(session.connections), ...session.blocked])] : []);
  const { people: discover, loading } = useDiscover();
  if (!session) return null;

  const by = (status: string) => known.filter((u) => session.connections[u.id] === status && !session.blocked.includes(u.id));
  const lists: Record<Tab, MockUser[]> = {
    requests: by("pending-in"),
    friends: by("accepted"),
    sent: by("pending-out"),
    discover: discover.filter((u) => !session.connections[u.id] && !session.blocked.includes(u.id)),
    blocked: known.filter((u) => session.blocked.includes(u.id)),
  };

  const setConn = (id: string, status: "accepted" | "pending-out" | null) =>
    updateSession((s) => {
      const next = { ...s.connections };
      if (status) next[id] = status;
      else delete next[id];
      return { connections: next };
    });

  const tabs: { id: Tab; label: string }[] = [
    { id: "requests", label: `Requests (${lists.requests.length})` },
    { id: "friends", label: `Connections (${lists.friends.length})` },
    { id: "sent", label: "Sent" },
    { id: "discover", label: "Discover" },
    { id: "blocked", label: "Blocked" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Social" title={<>Your <span className="text-brand">people</span></>} description="Follow foodies you vibe with and connect for future plans." />

      <div role="tablist" aria-label="Connections" className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors", tab === t.id ? "text-ink" : "text-soft hover:text-cream")}
          >
            {tab === t.id && <motion.span layoutId="conn-tab" className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {lists[tab].length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title={tab === "discover" && loading ? "Finding people…" : "Nothing here yet"}
          description={tab === "requests" ? "No pending requests. Meet people to grow your table." : "Check back after your next meeting."}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {lists[tab].map((u) => {
              const following = session.following.includes(u.id);
              return (
                <motion.li key={u.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>
                  <GlassCard className="flex items-center gap-4 p-4">
                    <Link href={`/profile/${u.id}`} className="size-14 shrink-0 overflow-hidden rounded-full" aria-label={`Open ${u.name}'s profile`}>
                      <LayeredAvatar config={u.avatar} title={u.name} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${u.id}`} className="block truncate font-semibold hover:text-peach">{u.name}</Link>
                      <p className="truncate text-xs text-soft">{u.area}, {u.city} · {toneLabel(u.tone)} · {u.foodInterests.slice(0, 2).join(", ")}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {tab === "requests" && (
                        <>
                          <IconBtn label="Reject" onClick={() => { setConn(u.id, null); syncBackend(() => respondConnection(u.id, false)); toast(`Declined ${u.name.split(" ")[0]}`); }}><X /></IconBtn>
                          <IconBtn label="Accept" brand onClick={() => { setConn(u.id, "accepted"); syncBackend(() => respondConnection(u.id, true)); toast.success(`You and ${u.name.split(" ")[0]} are connected`); }}><Check /></IconBtn>
                        </>
                      )}
                      {tab === "friends" && (
                        <GradientLink href="/wishlist" size="sm"><CalendarPlus /> Plan</GradientLink>
                      )}
                      {tab === "sent" && (
                        <GradientButton size="sm" variant="ghost" onClick={() => { setConn(u.id, null); syncBackend(() => cancelConnection(u.id)); }}>Cancel</GradientButton>
                      )}
                      {tab === "discover" && (
                        <>
                          <GradientButton size="sm" variant={following ? "glass" : "outline"} onClick={() => { updateSession((s) => ({ following: following ? s.following.filter((x) => x !== u.id) : [...s.following, u.id] })); syncBackend(() => setFollow(u.id, !following)); }}>
                            {following ? "Following" : "Follow"}
                          </GradientButton>
                          <IconBtn label="Send connection request" brand onClick={() => { setConn(u.id, "pending-out"); syncBackend(() => sendConnection(u.id)); toast.success("Request sent"); }}><UserPlus /></IconBtn>
                        </>
                      )}
                      {tab === "blocked" && (
                        <GradientButton size="sm" variant="outline" onClick={() => { updateSession((s) => ({ blocked: s.blocked.filter((x) => x !== u.id) })); syncBackend(() => setBlock(u.id, false)); }}>
                          <Ban /> Unblock
                        </GradientButton>
                      )}
                    </div>
                  </GlassCard>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function IconBtn({ children, label, brand, onClick }: { children: React.ReactNode; label: string; brand?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("grid size-10 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 [&_svg]:size-4", brand ? "bg-brand text-ink" : "bg-white/10 hover:bg-white/20")}
    >
      {children}
    </button>
  );
}
