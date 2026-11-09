"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({
  selected,
  className,
  children,
  showCheck = true,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean; showCheck?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95",
        selected
          ? "border-transparent bg-brand text-ink shadow-[0_6px_24px_-8px_rgb(255_126_95/0.7)]"
          : "border-white/12 bg-white/[0.03] text-cream/85 hover:border-peach/50 hover:text-cream",
        className,
      )}
      {...props}
    >
      {selected && showCheck && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}
