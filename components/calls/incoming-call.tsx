"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { answerCall, loadIncomingCall, type IncomingCall } from "@/lib/actions/calls";
import { isUuid } from "@/lib/db/map";
import { useSession } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";

/** Rings anywhere in the app when a connection calls you (Realtime on your rows in `calls`). */
export function IncomingCallAlert() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userId = session?.user?.id;
  const live = backendEnabled() && !!userId && isUuid(userId);
  const [call, setCall] = useState<IncomingCall | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!live || !supabase || !userId) return;
    // Server actions hold up navigation, so only call one when a call is actually ringing.
    void supabase
      .from("calls")
      .select("id")
      .eq("callee_id", userId)
      .eq("status", "ringing")
      .gte("created_at", new Date(Date.now() - 45_000).toISOString())
      .limit(1)
      .then(({ data }) => {
        if (data?.length) void loadIncomingCall().then((c) => c && setCall(c));
      });
    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` }, (change) => {
        void loadIncomingCall((change.new as { id: string }).id).then((c) => c && setCall(c));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` }, (change) => {
        const row = change.new as { id: string; status: string };
        if (row.status !== "ringing") setCall((c) => (c?.id === row.id ? null : c));
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [live, userId]);

  // Stop ringing on its own after the ring window.
  useEffect(() => {
    if (!call) return;
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    const t = setTimeout(() => setCall(null), 45_000);
    return () => clearTimeout(t);
  }, [call]);

  const visible = call && pathname !== `/call/${call.id}`;

  async function answer(accept: boolean) {
    if (!call) return;
    setBusy(true);
    const res = await answerCall(call.id, accept);
    setBusy(false);
    const id = call.id;
    setCall(null);
    if (!res.ok) return toast.error(res.error);
    if (accept) router.push(`/call/${id}`);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alertdialog"
          aria-label={`Incoming ${call.kind} call from ${call.from.name}`}
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          className="glass-strong fixed inset-x-4 top-4 z-[100] mx-auto flex max-w-md items-center gap-4 rounded-3xl p-4 shadow-2xl"
        >
          <span className="size-14 shrink-0 animate-pulse overflow-hidden rounded-full">
            <LayeredAvatar config={call.from.avatar} title={call.from.name} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{call.from.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-soft">
              {call.kind === "video" ? <Video className="size-3.5" /> : <Phone className="size-3.5" />}
              Incoming {call.kind} call
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => void answer(false)} aria-label="Decline" className="grid size-12 place-items-center rounded-full bg-red-500 text-white [&_svg]:size-5">
            <PhoneOff />
          </button>
          <button type="button" disabled={busy} onClick={() => void answer(true)} aria-label="Accept" className="grid size-12 place-items-center rounded-full bg-green-500 text-white [&_svg]:size-5">
            <Phone />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
