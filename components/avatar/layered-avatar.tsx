"use client";

import { useId } from "react";
import { backgrounds, hairColors, outfitColors, skinTones } from "@/lib/config/avatar-items";
import type { AvatarConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Snapchat/Bitmoji-style layered avatar drawn as SVG. Layers, back to front:
 * background → outfit → neck/head → hair → face → accessory.
 */
export function LayeredAvatar({
  config,
  className,
  title,
}: {
  config: AvatarConfig;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [bgA, bgB] = backgrounds[config.background] ?? backgrounds.peach;
  const skin = skinTones[config.skin] ?? skinTones.s2;
  const hair = hairColors[config.hairColor] ?? hairColors.black;
  const outfit = outfitColors[config.outfit] ?? outfitColors.tee;

  return (
    <svg viewBox="0 0 120 120" className={cn("block size-full", className)} role="img" aria-label={title ?? "Avatar"}>
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bgA} />
          <stop offset="1" stopColor={bgB} />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${uid})`}>
        <rect width="120" height="120" fill={`url(#bg-${uid})`} />

        {/* hair behind the head (long styles) */}
        {config.hair === "long" && <path d="M34 58 C32 30 88 30 86 58 L90 96 L30 96 Z" fill={hair} />}

        {/* outfit */}
        <path d="M14 124 C16 94 38 86 60 86 C82 86 104 94 106 124 Z" fill={outfit} />
        {config.outfit === "kurta" && <path d="M60 86 L60 108" stroke="#0b0c0f55" strokeWidth="2" />}
        {config.outfit === "hoodie" && (
          <>
            <path d="M44 88 C48 100 72 100 76 88" fill="none" stroke="#ffffff33" strokeWidth="3" />
            <path d="M54 96 L54 108 M66 96 L66 108" stroke="#ffffff55" strokeWidth="1.5" />
          </>
        )}
        {config.outfit === "jacket" && <path d="M60 88 L50 120 M60 88 L70 120" stroke="#ff936f" strokeWidth="2" />}
        {config.outfit === "chef" && (
          <g fill="#0b0c0f66">
            <circle cx="54" cy="100" r="1.8" />
            <circle cx="66" cy="100" r="1.8" />
            <circle cx="54" cy="110" r="1.8" />
            <circle cx="66" cy="110" r="1.8" />
          </g>
        )}
        {config.outfit === "neon" && <path d="M30 104 L90 104" stroke="#f0abfc" strokeWidth="2.5" />}

        {/* neck + head */}
        <rect x="52" y="74" width="16" height="16" rx="6" fill={skin} />
        <ellipse cx="60" cy="58" rx="22" ry="25" fill={skin} />
        <ellipse cx="38" cy="60" rx="3.5" ry="5" fill={skin} />
        <ellipse cx="82" cy="60" rx="3.5" ry="5" fill={skin} />

        {/* hair */}
        {(config.hair === "short" || config.hair === "long" || config.hair === "bun") && (
          <path d="M37 56 C34 32 50 28 60 28 C72 28 87 33 83 56 C79 44 70 40 60 41 C50 41 42 45 37 56 Z" fill={hair} />
        )}
        {config.hair === "bun" && <circle cx="60" cy="24" r="9" fill={hair} />}
        {config.hair === "curly" && (
          <g fill={hair}>
            {[38, 46, 54, 62, 70, 78, 84].map((x, i) => (
              <circle key={x} cx={x} cy={i % 2 ? 34 : 40} r="9" />
            ))}
          </g>
        )}
        {config.hair === "mohawk" && <path d="M54 44 C54 30 58 20 60 18 C62 20 66 30 66 44 Z" fill={hair} />}

        {/* face */}
        <circle cx="51" cy="60" r="2.4" fill="#1c1a1a" />
        <circle cx="69" cy="60" r="2.4" fill="#1c1a1a" />
        <path d="M52 70 C56 75 64 75 68 70" fill="none" stroke="#1c1a1a" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="46" cy="68" r="3" fill="#ff7e5f33" />
        <circle cx="74" cy="68" r="3" fill="#ff7e5f33" />

        {/* accessories */}
        {config.accessory === "glasses" && (
          <g fill="none" stroke="#1c1a1a" strokeWidth="2">
            <circle cx="51" cy="60" r="7" />
            <circle cx="69" cy="60" r="7" />
            <path d="M58 60 L62 60" />
          </g>
        )}
        {config.accessory === "shades" && (
          <g fill="#111">
            <rect x="42" y="55" width="16" height="10" rx="4" />
            <rect x="62" y="55" width="16" height="10" rx="4" />
            <rect x="57" y="58" width="6" height="2" />
          </g>
        )}
        {config.accessory === "cap" && (
          <g fill="#ff7e5f">
            <path d="M36 50 C36 30 84 30 84 50 Z" />
            <rect x="60" y="46" width="34" height="6" rx="3" />
          </g>
        )}
        {config.accessory === "headphones" && (
          <g>
            <path d="M36 58 C34 26 86 26 84 58" fill="none" stroke="#222" strokeWidth="4" />
            <rect x="30" y="52" width="9" height="16" rx="4" fill="#feb47b" />
            <rect x="81" y="52" width="9" height="16" rx="4" fill="#feb47b" />
          </g>
        )}
        {config.accessory === "crown" && (
          <path d="M42 34 L48 20 L54 30 L60 16 L66 30 L72 20 L78 34 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
        )}
      </g>
    </svg>
  );
}
