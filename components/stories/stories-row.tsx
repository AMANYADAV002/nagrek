"use client";

import { useState } from "react";
import { StoryRing } from "@/components/avatar/story-ring";
import { AddStoryButton } from "@/components/stories/add-story-button";
import { StoryViewer } from "@/components/story-viewer/story-viewer";
import { useSession } from "@/lib/mock/session";
import { groupSeen, storyHandlers, useStoryGroups } from "@/lib/stories";

/** Horizontal Instagram-style row of story rings with the full-screen viewer. */
export function StoriesRow({ onlyUserId, showAdd = true }: { onlyUserId?: string; showAdd?: boolean }) {
  const session = useSession();
  const [open, setOpen] = useState<number | null>(null);
  const all = useStoryGroups(session);
  const [handlers] = useState(storyHandlers);

  if (!session) return null;
  const groups = onlyUserId ? all.filter((g) => g.userId === onlyUserId) : all;

  return (
    <>
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 py-1">
        {showAdd && !onlyUserId && (
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <AddStoryButton />
            <span className="text-[11px] text-soft">Add story</span>
          </div>
        )}
        {groups.map((g, idx) => (
          <div key={g.userId} className="flex shrink-0 flex-col items-center gap-1.5">
            <StoryRing
              avatar={g.avatar}
              name={g.name}
              state={groupSeen(g, session.seenStories) ? "seen" : "unseen"}
              onClick={() => setOpen(idx)}
            />
            <span className="max-w-16 truncate text-[11px] text-soft">{g.isMine ? "You" : g.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
      {open !== null && groups.length > 0 && (
        <StoryViewer groups={groups} startGroup={open} onClose={() => setOpen(null)} onSeen={handlers.onSeen} onDelete={handlers.onDelete} />
      )}
    </>
  );
}
