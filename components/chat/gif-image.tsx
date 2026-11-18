"use client";

import { useState } from "react";
import { mediaFileSrc } from "@/lib/chat/media";

/** A GIF file in a fixed box. A failed load becomes a plain tile instead of a broken icon. */
export function GifImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const display = mediaFileSrc(src);
  if (failed || !display) {
    return <div className={`bg-white/10 ${className ?? ""}`} role="img" aria-label={alt || "GIF unavailable"} />;
  }
  return (
    // The image optimizer freezes animated GIFs, so this stays a plain image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={display}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
