"use client";

import EmojiPicker, { EmojiStyle, SuggestionMode, Theme } from "emoji-picker-react";

/** Full categorized picker. Loaded only after the media button opens. */
export default function EmojiPanel({ onSelect }: { onSelect: (native: string) => void }) {
  return (
    <EmojiPicker
      theme={Theme.DARK}
      emojiStyle={EmojiStyle.NATIVE}
      suggestedEmojisMode={SuggestionMode.RECENT}
      skinTonesDisabled={false}
      searchPlaceHolder="Search emojis"
      searchPlaceholder="Search emojis"
      autoFocusSearch={false}
      reactionsDefaultOpen={false}
      lazyLoadEmojis
      previewConfig={{ showPreview: false }}
      width="100%"
      height={300}
      onEmojiClick={(emoji) => onSelect(emoji.emoji)}
    />
  );
}
