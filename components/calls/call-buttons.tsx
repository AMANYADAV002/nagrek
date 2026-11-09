"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Video } from "lucide-react";
import { toast } from "sonner";
import { startCall, type CallKind } from "@/lib/actions/calls";
import { isUuid } from "@/lib/db/map";
import { backendEnabled } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/** Voice and video call buttons for a connection. Live accounts only: calls go by user id, never phone number. */
export function CallButtons({ personId, name, className }: { personId: string; name: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<CallKind | null>(null);
  if (!backendEnabled() || !isUuid(personId)) return null;

  async function call(kind: CallKind) {
    setBusy(kind);
    const res = await startCall(personId, kind);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    router.push(`/call/${res.callId}`);
  }

  const first = name.split(" ")[0];
  const btn = "grid size-10 place-items-center rounded-full bg-white/10 transition-transform hover:scale-105 hover:bg-white/20 active:scale-95 disabled:opacity-50 [&_svg]:size-4";
  return (
    <div className={cn("flex gap-1.5", className)}>
      <button type="button" className={btn} disabled={!!busy} onClick={() => void call("voice")} aria-label={`Voice call ${first}`} title={`Voice call ${first}`}>
        <Phone />
      </button>
      <button type="button" className={btn} disabled={!!busy} onClick={() => void call("video")} aria-label={`Video call ${first}`} title={`Video call ${first}`}>
        <Video />
      </button>
    </div>
  );
}
