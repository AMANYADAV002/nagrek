"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { LayeredAvatar } from "@/components/avatar/layered-avatar";
import { GifImage } from "@/components/chat/gif-image";
import { ChatComposer, type ChatPiece } from "@/components/chat/chat-composer";
import { loadStoryComments, postStoryComment, type StoryComment } from "@/lib/actions/story-comments";
import { allowedMediaUrl, playableMediaUrl } from "@/lib/chat/media";
import { timeAgo } from "@/lib/format";
import { useSession } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { splitComment } from "@/lib/stories/comment-text";
import { rememberStory, type StoryReturn } from "@/lib/stories/return";

function merge(current: StoryComment[], incoming: StoryComment[]) {
  const map = new Map(current.map((comment) => [comment.id, comment]));
  for (const comment of incoming) map.set(comment.id, comment);
  return [...map.values()].sort((a, b) => a.at.localeCompare(b.at));
}

interface ThreadPage {
  storyId: string;
  comments: StoryComment[];
  count: number;
  older: string | null;
  mentions: Record<string, string>;
  warning: string;
}

function blank(storyId: string): ThreadPage {
  return { storyId, comments: [], count: 0, older: null, mentions: {}, warning: "" };
}

export function useStoryThread(storyId: string) {
  const session = useSession();
  const [page, setPage] = useState<ThreadPage | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const view = page?.storyId === storyId ? page : blank(storyId);

  function update(story: string, change: (current: ThreadPage) => ThreadPage) {
    setPage((current) => change(current?.storyId === story ? current : blank(story)));
  }

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    void loadStoryComments(storyId).then((res) => {
      if (cancelled) return;
      if ("error" in res) {
        update(storyId, (current) => ({ ...current, warning: res.error }));
        return;
      }
      update(storyId, () => ({ storyId, comments: res.comments, count: res.count, older: res.older, mentions: res.mentions, warning: res.warning }));
    });
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return () => { cancelled = true; };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`story-comments:${storyId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_comments", filter: `story_id=eq.${storyId}` }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void loadStoryComments(storyId).then((res) => {
            if (cancelled || "error" in res) return;
            update(storyId, (current) => ({
              ...current,
              comments: merge(current.comments, res.comments),
              count: res.count,
              mentions: { ...current.mentions, ...res.mentions },
            }));
          });
        }, 250);
      })
      .subscribe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [storyId]);

  async function loadOlder() {
    if (!view.older) return;
    const res = await loadStoryComments(storyId, view.older);
    if ("error" in res) return toast.error(res.error);
    update(storyId, (current) => ({
      ...current,
      comments: merge(res.comments, current.comments),
      older: res.older,
      mentions: { ...current.mentions, ...res.mentions },
      warning: res.warning || current.warning,
    }));
  }

  async function send(piece: ChatPiece) {
    const me = session?.user;
    if (!me) return toast.error("Sign in to comment.");
    const optimistic: StoryComment = {
      id: `local-${crypto.randomUUID()}`,
      storyId,
      authorId: me.id,
      name: me.name,
      handle: me.handle,
      avatar: session.avatar,
      kind: piece.kind,
      body: piece.body,
      at: new Date().toISOString(),
    };
    update(storyId, (current) => ({ ...current, comments: [...current.comments, optimistic], count: current.count + 1 }));
    setDraft("");
    setSending(true);
    try {
      const res = await postStoryComment(storyId, piece.body, piece.kind);
      if (!res.ok) {
        console.error("postStoryComment failed", res.error);
        update(storyId, (current) => ({
          ...current,
          comments: current.comments.filter((comment) => comment.id !== optimistic.id),
          count: Math.max(0, current.count - 1),
        }));
        setDraft(piece.kind === "text" || piece.kind === "emoji" ? piece.body : "");
        return toast.error(res.error);
      }
      update(storyId, (current) => ({
        ...current,
        comments: current.comments.map((comment) => (comment.id === optimistic.id ? res.comment : comment)),
        count: res.count,
      }));
    } catch (error) {
      console.error("postStoryComment failed", error);
      update(storyId, (current) => ({
        ...current,
        comments: current.comments.filter((comment) => comment.id !== optimistic.id),
        count: Math.max(0, current.count - 1),
      }));
      toast.error("Could not post that comment.");
    } finally {
      setSending(false);
    }
  }

  return { comments: view.comments, count: view.count, older: view.older, mentions: view.mentions, warning: view.warning, sending, draft, setDraft, loadOlder, send };
}

function CommentContent({ comment, mentions, onProfile }: { comment: StoryComment; mentions: Record<string, string>; onProfile: (userId: string) => void }) {
  if (comment.kind === "gif" || comment.kind === "sticker" || allowedMediaUrl(comment.body)) {
    return (
      <div className="aspect-[4/3] w-36 shrink-0 overflow-hidden rounded-xl bg-white/5">
        <GifImage src={playableMediaUrl(comment.body)} alt={comment.kind === "sticker" ? "Sticker" : "GIF"} className="h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <p className="text-sm break-words text-cream">
      {splitComment(comment.body).map((part, index) => {
        if (part.type === "mention") {
          const id = mentions[part.handle.toLowerCase()];
          if (!id) return <span key={index}>@{part.handle}</span>;
          return (
            <button key={index} type="button" onClick={() => onProfile(id)} className="font-semibold text-peach hover:underline">
              @{part.handle}
            </button>
          );
        }
        if (part.type === "profile") {
          return (
            <button key={index} type="button" onClick={() => onProfile(part.id)} className="font-semibold text-peach hover:underline">
              {part.label}
            </button>
          );
        }
        if (part.type === "link") {
          return (
            <a key={index} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="text-peach underline underline-offset-2">
              {part.label}
            </a>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </p>
  );
}

export function StoryCommentButton({ count, onClick }: { count: number; onClick: () => void }) {
  const label = count === 1 ? "1 comment" : `${count} comments`;
  return (
    <button type="button" onClick={onClick} aria-label={label} className="relative grid size-11 shrink-0 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
      <MessageCircle className="size-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-ink">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

export function StoryCommentDrawer({
  storyId,
  groupUserId,
  surface,
  thread,
  onClose,
}: {
  storyId: string;
  groupUserId: string;
  surface: StoryReturn["surface"];
  thread: ReturnType<typeof useStoryThread>;
  onClose: () => void;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const { comments, older, mentions, warning, sending, draft, setDraft, loadOlder, send } = thread;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [comments.length]);

  function openProfile(userId: string) {
    rememberStory({ path: window.location.pathname, surface, groupUserId, storyId, comments: true });
    router.push(`/profile/${userId}?from=${encodeURIComponent(window.location.pathname)}`);
  }

  return (
    <section className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70%] flex-col rounded-t-3xl border border-white/10 bg-[#121318]/95 shadow-2xl" aria-label="Story comments">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold">Comments</p>
        <button type="button" onClick={onClose} className="text-xs text-soft hover:text-cream">Close</button>
      </div>
      {warning && <p className="px-4 pb-2 text-xs text-soft">{warning}</p>}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        {older && (
          <button type="button" onClick={() => void loadOlder()} className="text-xs font-semibold text-peach">
            Older comments
          </button>
        )}
        {comments.length === 0 && !warning && <p className="py-6 text-center text-sm text-soft">Be the first to comment.</p>}
        {comments.map((comment) => (
          <article key={comment.id} className="flex gap-2">
            <button type="button" onClick={() => openProfile(comment.authorId)} aria-label={`${comment.name}'s profile`} className="size-9 shrink-0 overflow-hidden rounded-full">
              <LayeredAvatar config={comment.avatar} title={comment.name} />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-soft">
                <button type="button" onClick={() => openProfile(comment.authorId)} className="font-semibold text-cream hover:underline">
                  {comment.name}
                </button>
                {" · "}
                {timeAgo(comment.at)}
              </p>
              <CommentContent comment={comment} mentions={mentions} onProfile={openProfile} />
            </div>
          </article>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={(piece) => void send(piece)}
          disabled={sending}
          placeholder="Comment"
          label="Comment on this story"
        />
      </div>
    </section>
  );
}
