"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Send, Smile } from "lucide-react";
import { GifImage } from "@/components/chat/gif-image";
import { CRAVING_CHIPS, isEmojiMessage, playableMediaUrl, type MediaHit, type MediaKind } from "@/lib/chat/media";

const EmojiPanel = dynamic(() => import("@/components/chat/emoji-panel"), {
  ssr: false,
  loading: () => <p className="px-4 py-10 text-center text-sm text-soft">Loading emojis…</p>,
});

export interface ChatPiece {
  kind: "text" | "emoji" | "gif" | "sticker";
  body: string;
}

const TABS = [
  { id: "emoji", label: "Emojis" },
  { id: "gif", label: "GIFs" },
  { id: "sticker", label: "Stickers" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/** Input bar plus the emoji / GIF / sticker picker. The panel is a popover, so the message list still scrolls. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  label,
  leading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (piece: ChatPiece) => void;
  disabled?: boolean;
  placeholder: string;
  label: string;
  leading?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("emoji");
  const [large, setLarge] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = value.trim().slice(0, 500);
    if (!body || disabled) return;
    onSend({ kind: isEmojiMessage(body) ? "emoji" : "text", body });
    setOpen(false);
  }

  function pickEmoji(native: string) {
    if (large) {
      onSend({ kind: "emoji", body: native });
      setOpen(false);
      return;
    }
    onChange(`${value}${native}`.slice(0, 500));
  }

  function pickMedia(hit: MediaHit) {
    if (hit.emoji) onSend({ kind: "emoji", body: hit.emoji });
    else if (hit.url) onSend({ kind: hit.kind, body: playableMediaUrl(hit.url) });
    setOpen(false);
  }

  function onTabKey(event: React.KeyboardEvent) {
    const index = TABS.findIndex((item) => item.id === tab);
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length;
    setTab(TABS[next].id);
  }

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Emojis, GIFs, and stickers"
          className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-3xl border border-white/10 bg-[#121318] shadow-2xl"
        >
          <div role="tablist" aria-label="Media" className="flex border-b border-white/10" onKeyDown={onTabKey}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${panelId}-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`${panelId}-panel`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                className={`flex-1 py-2.5 text-xs font-semibold ${tab === item.id ? "text-cream" : "text-soft"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${panelId}-panel`} aria-labelledby={`${panelId}-${tab}`}>
            {tab === "emoji" ? (
              <div>
                <div className="flex gap-2 px-3 py-2">
                  <button type="button" onClick={() => setLarge(false)} className={`rounded-full px-3 py-1 text-xs ${large ? "bg-white/10 text-soft" : "bg-brand text-ink"}`}>
                    Insert
                  </button>
                  <button type="button" onClick={() => setLarge(true)} className={`rounded-full px-3 py-1 text-xs ${large ? "bg-brand text-ink" : "bg-white/10 text-soft"}`}>
                    Send large
                  </button>
                </div>
                <EmojiPanel onSelect={pickEmoji} />
              </div>
            ) : (
              <MediaGrid kind={tab} onPick={pickMedia} />
            )}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="Emojis, GIFs, and stickers"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-cream disabled:opacity-40"
        >
          <Smile className="size-4" />
        </button>
        {leading}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={500}
          placeholder={placeholder}
          aria-label={label}
          disabled={disabled}
          className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-peach disabled:opacity-40"
        />
        <button type="submit" aria-label="Send" disabled={disabled || !value.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-ink disabled:opacity-40">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

function MediaGrid({ kind, onPick }: { kind: MediaKind; onPick: (hit: MediaHit) => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [result, setResult] = useState<{ key: string; items: MediaHit[]; hint: string }>({ key: "", items: [], hint: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const requestKey = `${kind}:${debounced}`;
  const current = result.key === requestKey ? result : null;

  useEffect(() => {
    const ctrl = new AbortController();
    const key = `${kind}:${debounced}`;
    fetch(`/api/media?kind=${kind}&q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then(async (res) => {
        const data = (await res.json()) as { items?: MediaHit[]; hint?: string; error?: string };
        if (!res.ok) throw new Error(data.error || "search");
        setResult({ key, items: data.items ?? [], hint: data.hint ?? "" });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ key, items: [], hint: "Couldn't load media. Try again." });
      });
    return () => ctrl.abort();
  }, [kind, debounced]);

  const items = current?.items ?? [];
  const hint = current?.hint ?? "";
  const loading = current === null;

  return (
    <div className="flex h-80 flex-col">
      <label className="sr-only" htmlFor={`media-search-${kind}`}>
        {kind === "gif" ? "Search GIFs" : "Search stickers"}
      </label>
      <input
        id={`media-search-${kind}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={kind === "gif" ? "Search GIFs" : "Search stickers"}
        maxLength={40}
        className="mx-3 mt-3 h-9 rounded-full border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-peach"
      />
      <div className="flex gap-2 overflow-x-auto px-3 py-2">
        {CRAVING_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => setQuery(chip.query)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${query === chip.query ? "bg-brand text-ink" : "bg-white/10 text-soft"}`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {hint && <p className="px-3 pb-1 text-[11px] text-soft">{hint}</p>}
      <div className="grid flex-1 grid-cols-3 content-start gap-2 overflow-y-auto px-3 pb-3">
        {items.map((hit) => (
          <button key={hit.id} type="button" onClick={() => onPick(hit)} aria-label={hit.title} className="aspect-square h-24 w-full overflow-hidden rounded-xl bg-white/5">
            {hit.emoji ? (
              <span className="grid h-full place-items-center text-4xl">{hit.emoji}</span>
            ) : (
              <GifImage src={hit.preview || hit.url} alt={hit.title} eager className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
      {loading && <p className="sr-only">Loading {kind === "gif" ? "GIFs" : "stickers"}</p>}
      {!loading && items.length === 0 && <p className="px-3 pb-3 text-center text-xs text-soft">Nothing matched. Try a craving chip.</p>}
    </div>
  );
}
