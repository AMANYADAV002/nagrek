"use client";

import { useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { uid } from "@/lib/format";
import { updateSession, useSession } from "@/lib/mock/session";
import {
  compressImage, compressImageBlob, registerBlobUrl, STORY_MAX_BYTES, STORY_MAX_VIDEO_SECONDS, uploadLiveStory, videoDuration,
} from "@/lib/stories";
import { backendEnabled } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/**
 * Posts a photo or a ≤30 s clip as a story. Live: uploaded to the private Storage bucket and
 * published by the server. Demo: kept in this browser only.
 */
export function AddStoryButton({
  className,
  caption,
  matchId,
  children,
}: {
  className?: string;
  caption?: string;
  /** Set for meeting stories; the server checks the partner agreed. */
  matchId?: string;
  children?: React.ReactNode;
}) {
  const session = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const live = backendEnabled();

  async function onFile(file: File) {
    if (file.size > STORY_MAX_BYTES) return toast.error("That file is over 50 MB.");
    setBusy(true);
    try {
      let kind: "image" | "video";
      if (file.type.startsWith("video/")) {
        const probe = URL.createObjectURL(file);
        const d = await videoDuration(probe);
        if (d > STORY_MAX_VIDEO_SECONDS + 0.5) {
          URL.revokeObjectURL(probe);
          toast.error(`Clips can be up to ${STORY_MAX_VIDEO_SECONDS} seconds.`);
          return;
        }
        kind = "video";
        if (live) {
          URL.revokeObjectURL(probe);
        } else {
          registerBlobUrl(probe);
          addDemoStory(kind, probe);
        }
      } else if (file.type.startsWith("image/")) {
        kind = "image";
        if (!live) addDemoStory(kind, await compressImage(file));
      } else {
        toast.error("Stories must be a photo or a video.");
        return;
      }

      if (live) {
        if (!session?.user) return toast.error("Sign in to post a story.");
        const blob = kind === "image" ? await compressImageBlob(file) : file;
        const res = await uploadLiveStory(session.user.id, blob, kind, caption, matchId);
        if (!res.ok) return toast.error(res.error);
      }
      track("story_posted", { kind });
      toast.success("Story posted! It disappears in 24 hours.");
    } catch {
      toast.error("Could not read that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function addDemoStory(kind: "image" | "video", src: string) {
    updateSession((s) => ({
      myStories: [...s.myStories, { id: uid("story"), userId: "me", kind, src, caption, createdAt: new Date().toISOString(), views: 0 }],
    }));
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={cn(
          "grid size-16 place-items-center rounded-full border-2 border-dashed border-peach/50 text-peach transition-colors hover:bg-peach/10",
          className,
        )}
        aria-label="Add a story"
        aria-busy={busy}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : (children ?? <Plus className="size-6" />)}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </>
  );
}
