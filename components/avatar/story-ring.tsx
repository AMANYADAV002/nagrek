"use client";

import { LayeredAvatar } from "./layered-avatar";
import type { AvatarConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Avatar with an Instagram-style ring: gradient when there is an unseen story. */
export function StoryRing({
  avatar,
  name,
  state = "none",
  size = 64,
  onClick,
  className,
  label,
}: {
  avatar: AvatarConfig;
  name: string;
  state?: "unseen" | "seen" | "none";
  size?: number;
  onClick?: () => void;
  className?: string;
  label?: string;
}) {
  const ring =
    state === "unseen" ? "ring-brand" : state === "seen" ? "bg-white/20" : "bg-transparent";
  const content = (
    <span className={cn("block rounded-full p-[3px]", ring)} style={{ width: size, height: size }}>
      <span className="block size-full rounded-full bg-ink p-[2px]">
        <LayeredAvatar config={avatar} title={name} />
      </span>
    </span>
  );
  if (!onClick) return <span className={className}>{content}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? (state === "unseen" ? `View ${name}'s new story` : `Open ${name}`)}
      className={cn("rounded-full transition-transform hover:scale-105 active:scale-95", className)}
    >
      {content}
    </button>
  );
}
