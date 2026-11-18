import { GifImage } from "@/components/chat/gif-image";
import { allowedMediaUrl, isEmojiMessage, playableMediaUrl } from "@/lib/chat/media";

/** One message in a call or a History thread. GIFs and stickers loop via the image itself. */
export function ChatBubble({
  mine,
  kind,
  body,
  url,
}: {
  mine: boolean;
  kind: string;
  body: string;
  url?: string | null;
}) {
  const align = mine ? "ml-auto" : "";

  if (kind === "voice") {
    return (
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${align} ${mine ? "bg-brand text-ink" : "bg-white/10"}`}>
        {url ? <audio controls preload="none" src={url} className="h-8 max-w-full" /> : <span>Voice note</span>}
      </div>
    );
  }

  const media = kind === "gif" || kind === "sticker" || allowedMediaUrl(body);
  if (media) {
    if (!allowedMediaUrl(body)) {
      return <p className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm text-soft ${align} bg-white/10`}>That media couldn&apos;t be shown.</p>;
    }
    const sticker = kind === "sticker" || body.includes("/stickers/");
    return (
      <div className={`aspect-[4/3] w-56 max-w-[80%] shrink-0 overflow-hidden rounded-2xl bg-white/5 ${align}`}>
        <GifImage src={playableMediaUrl(body)} alt={sticker ? "Sticker" : "GIF"} className="h-full w-full object-contain" />
      </div>
    );
  }

  const large = kind === "emoji" || isEmojiMessage(body);
  return (
    <p className={`max-w-[80%] rounded-2xl px-3 py-2 ${align} ${mine ? "bg-brand text-ink" : "bg-white/10"} ${large ? "text-4xl leading-none" : "text-sm"}`}>
      {body}
    </p>
  );
}
