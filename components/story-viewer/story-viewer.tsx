"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Flag, Pause, Play, Trash2, X } from "lucide-react";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { ReportDialog } from "@/components/safety/report-dialog";
import { StoryCommentButton, StoryCommentDrawer, useStoryThread } from "@/components/story-viewer/story-comments";
import { timeAgo } from "@/lib/format";
import { rawStorySrc } from "@/lib/stories";
import type { StoryReturn } from "@/lib/stories/return";
import type { AvatarConfig, Story } from "@/lib/types";

export interface StoryGroup {
  userId: string;
  name: string;
  avatar: AvatarConfig;
  stories: Story[];
  isMine?: boolean;
}

const IMAGE_DURATION_MS = 5000;

/**
 * Full-screen Instagram-style story viewer.
 * Tap right/left to advance/go back, hold to pause, swipe down (or Esc) to close.
 */
export function StoryViewer({
  groups,
  startGroup = 0,
  startStoryId,
  startComments = false,
  surface = "stories-row",
  onClose,
  onSeen,
  onDelete,
  onHide,
}: {
  groups: StoryGroup[];
  startGroup?: number;
  startStoryId?: string;
  startComments?: boolean;
  surface?: StoryReturn["surface"];
  onClose: () => void;
  onSeen?: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
  onHide?: (storyId: string) => void;
}) {
  const [g, setG] = useState(startGroup);
  const [i, setI] = useState(() => {
    const found = startStoryId ? groups[startGroup]?.stories.findIndex((item) => item.id === startStoryId) ?? -1 : -1;
    return found >= 0 ? found : 0;
  });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(startComments);
  const [reportOpen, setReportOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const group = groups[g];
  const story = group?.stories[i];
  const upcoming = group?.stories[i + 1] ?? groups[g + 1]?.stories[0];
  const thread = useStoryThread(story?.id ?? "");
  const hold = paused || commentsOpen || reportOpen;

  const next = useCallback(() => {
    setProgress(0);
    if (!group) return onClose();
    if (i < group.stories.length - 1) setI(i + 1);
    else if (g < groups.length - 1) {
      setG(g + 1);
      setI(0);
    } else onClose();
  }, [g, i, group, groups.length, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    if (i > 0) setI(i - 1);
    else if (g > 0) {
      setG(g - 1);
      setI(0);
    }
  }, [g, i]);

  const storyId = story?.id;
  useEffect(() => {
    if (storyId) onSeen?.(storyId);
  }, [storyId, onSeen]);

  // The next story's file starts loading while this one is on screen.
  useEffect(() => {
    if (!upcoming?.src) return;
    if (upcoming.kind === "video") {
      const video = document.createElement("video");
      video.preload = "auto";
      video.src = upcoming.src;
      video.load();
      return () => {
        video.src = "";
      };
    }
    const img = document.createElement("img");
    img.src = upcoming.src;
  }, [upcoming?.src, upcoming?.kind]);

  // Image timer. Videos drive progress from their own timeupdate events.
  const storyKind = story?.kind;
  useEffect(() => {
    if (!storyId || storyKind === "video" || hold) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const np = p + dt / IMAGE_DURATION_MS;
        if (np >= 1) {
          queueMicrotask(next);
          return 1;
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [storyId, storyKind, hold, next]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hold) v.pause();
    else v.play().catch(() => {});
  }, [hold, storyId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reportOpen) return;
      if (commentsOpen) {
        if (e.key === "Escape") setCommentsOpen(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose, reportOpen, commentsOpen]);

  if (!group || !story) return null;

  function onPointerDown() {
    if (commentsOpen) return;
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setPaused(true);
    }, 220);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (commentsOpen) return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (held.current) {
      setPaused(false);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl" role="dialog" aria-modal aria-label={`${group.name}'s story`}>
      <motion.div
        drag={commentsOpen ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
        className="relative h-dvh w-full max-w-md overflow-hidden bg-ink md:h-[92dvh] md:rounded-3xl"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={story.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            {story.kind === "video" ? (
              <video
                ref={videoRef}
                src={story.src}
                className="size-full object-cover"
                playsInline
                autoPlay
                muted={false}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress(v.currentTime / v.duration);
                }}
                onEnded={next}
              />
            ) : rawStorySrc(story.src) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.src} alt={story.caption ?? "Story"} className="size-full object-cover" />
            ) : (
              <Image src={story.src} alt={story.caption ?? "Story"} fill sizes="448px" className="object-cover" preload />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />

        {/* tap zones */}
        <div
          className={`absolute inset-0 z-10 touch-none select-none ${commentsOpen ? "pointer-events-none" : ""}`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => holdTimer.current && clearTimeout(holdTimer.current)}
        />

        {/* progress bars */}
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
          {group.stories.map((s, idx) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white"
                style={{ width: `${idx < i ? 100 : idx === i ? progress * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="absolute inset-x-3 top-6 z-20 flex items-center gap-3">
          <div className="size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/40">
            <LayeredAvatar config={group.avatar} title={group.name} />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">{group.name}</p>
            <p className="text-xs text-white/70">{timeAgo(story.createdAt)}</p>
          </div>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="grid size-9 place-items-center rounded-full hover:bg-white/10">
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
          {group.isMine ? (
            <button
              type="button"
              aria-label="Delete story"
              onClick={() => {
                onDelete?.(story.id);
                next();
              }}
              className="grid size-9 place-items-center rounded-full hover:bg-white/10"
            >
              <Trash2 className="size-4" />
            </button>
          ) : (
            <button type="button" aria-label="Report story" onClick={() => setReportOpen(true)} className="grid size-9 place-items-center rounded-full hover:bg-white/10">
              <Flag className="size-4" />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close stories" className="grid size-9 place-items-center rounded-full hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>

        {/* footer */}
        <div className="absolute inset-x-4 bottom-6 z-20 flex items-end gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {story.caption && <p className="text-base font-medium [text-shadow:0_2px_10px_#000]">{story.caption}</p>}
            {group.isMine && (
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <Eye className="size-3.5" aria-hidden /> {story.views} views
              </p>
            )}
            <p className="text-[10px] text-white/50">Tap to advance · hold to pause · swipe down to close</p>
          </div>
          <StoryCommentButton count={thread.count} onClick={() => setCommentsOpen(true)} />
        </div>
        {commentsOpen && story.id && (
          <StoryCommentDrawer storyId={story.id} groupUserId={group.userId} surface={surface} thread={thread} onClose={() => setCommentsOpen(false)} />
        )}
      </motion.div>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="story"
        targetId={story.id}
        targetName={`${group.name}'s story`}
        onReported={() => {
          onHide?.(story.id);
          next();
        }}
      />
    </div>
  );
}
