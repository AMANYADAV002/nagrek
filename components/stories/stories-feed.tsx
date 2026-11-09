"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Eye } from "lucide-react";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { EmptyState } from "@/components/glass/states";
import { PageHeader } from "@/components/glass/section-heading";
import { StaggerItem, Stagger } from "@/components/motion/stagger";
import { AddStoryButton } from "@/components/stories/add-story-button";
import { StoriesRow } from "@/components/stories/stories-row";
import { StoryViewer } from "@/components/story-viewer/story-viewer";
import { timeAgo } from "@/lib/format";
import { updateSession, useSession } from "@/lib/mock/session";
import { buildStoryGroups } from "@/lib/stories";

export function StoriesFeed() {
  const session = useSession();
  const [open, setOpen] = useState<number | null>(null);
  if (!session) return null;
  const groups = buildStoryGroups(session);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Stories · last 24 hours"
        title={<>Tables around <span className="text-brand">you</span></>}
        description="Moments from meetups across Nagrek. Stories disappear after 24 hours. Tap and hold to pause, swipe down to close."
        action={
          <div className="flex items-center gap-3">
            <AddStoryButton className="size-12">
              <Camera className="size-5" />
            </AddStoryButton>
            <span className="text-xs text-soft">Photo or ≤30s clip</span>
          </div>
        }
      />
      <StoriesRow />

      {groups.length === 0 ? (
        <EmptyState icon={<Camera className="size-8" />} title="No stories yet" description="Be the first to share a table today." />
      ) : (
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {groups.map((g, idx) => {
            const s = g.stories[g.stories.length - 1];
            const isData = s.src.startsWith("data:") || s.src.startsWith("blob:");
            return (
              <StaggerItem key={g.userId}>
                <button
                  type="button"
                  onClick={() => setOpen(idx)}
                  className="group relative block aspect-[9/16] w-full overflow-hidden rounded-3xl border border-white/10 text-left"
                  aria-label={`Open ${g.name}'s story`}
                >
                  {s.kind === "video" ? (
                    <video src={s.src} muted playsInline className="size-full object-cover" />
                  ) : isData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.src} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <Image src={s.src} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="ring-brand block size-9 rounded-full p-[2px]">
                      <span className="block size-full rounded-full bg-ink p-[1px]">
                        <LayeredAvatar config={g.avatar} />
                      </span>
                    </span>
                    <span className="text-xs font-semibold [text-shadow:0_1px_6px_#000]">{g.isMine ? "You" : g.name.split(" ")[0]}</span>
                  </div>
                  <div className="absolute inset-x-3 bottom-3 space-y-1">
                    {s.caption && <p className="line-clamp-2 text-sm font-medium">{s.caption}</p>}
                    <p className="flex items-center gap-2 text-[10px] text-white/70">
                      {timeAgo(s.createdAt)} {g.isMine && <><Eye className="size-3" /> {s.views}</>}
                    </p>
                  </div>
                </button>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {open !== null && (
        <StoryViewer
          groups={groups}
          startGroup={open}
          onClose={() => setOpen(null)}
          onSeen={(id) => updateSession((s) => (s.seenStories.includes(id) ? {} : { seenStories: [...s.seenStories, id] }))}
          onDelete={(id) => updateSession((s) => ({ myStories: s.myStories.filter((x) => x.id !== id) }))}
        />
      )}
    </div>
  );
}
