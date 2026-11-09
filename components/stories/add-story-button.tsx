"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { uid } from "@/lib/format";
import { updateSession } from "@/lib/mock/session";
import {
  compressImage, registerBlobUrl, STORY_MAX_BYTES, STORY_MAX_VIDEO_SECONDS, videoDuration,
} from "@/lib/stories";
import { cn } from "@/lib/utils";

/**
 * Posts a photo or a ≤30 s clip as a story.
 * TODO(phase-6): upload to Supabase Storage with server-side limits + thumbnail job.
 */
export function AddStoryButton({ className, caption, children }: { className?: string; caption?: string; children?: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    if (file.size > STORY_MAX_BYTES) return toast.error("That file is over 50 MB.");
    setBusy(true);
    try {
      let src: string;
      let kind: "image" | "video";
      if (file.type.startsWith("video/")) {
        src = URL.createObjectURL(file);
        const d = await videoDuration(src);
        if (d > STORY_MAX_VIDEO_SECONDS + 0.5) {
          URL.revokeObjectURL(src);
          toast.error(`Clips can be up to ${STORY_MAX_VIDEO_SECONDS} seconds.`);
          return;
        }
        registerBlobUrl(src);
        kind = "video";
      } else if (file.type.startsWith("image/")) {
        src = await compressImage(file);
        kind = "image";
      } else {
        toast.error("Stories must be a photo or a video.");
        return;
      }
      updateSession((s) => ({
        myStories: [
          ...s.myStories,
          { id: uid("story"), userId: "me", kind, src, caption, createdAt: new Date().toISOString(), views: 0 },
        ],
      }));
      track("story_posted", { kind });
      toast.success("Story posted! It disappears in 24 hours.");
    } catch {
      toast.error("Could not read that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
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
      >
        {children ?? <Plus className="size-6" />}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </>
  );
}
