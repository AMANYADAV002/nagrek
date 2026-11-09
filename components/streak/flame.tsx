"use client";

import { motion } from "framer-motion";

/** Animated SVG flame. Intensity (0–1) scales size and glow. */
export function Flame({ intensity = 0.5, size = 160 }: { intensity?: number; size?: number }) {
  const s = 0.75 + intensity * 0.35;
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,#ff7e5f66,transparent_65%)] blur-xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.svg
        viewBox="0 0 100 120"
        className="relative size-full"
        style={{ scale: s }}
        animate={{ scaleY: [1, 1.06, 0.98, 1], rotate: [0, -1.5, 1.5, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="flame-outer" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff5f3a" />
            <stop offset="0.6" stopColor="#ff7e5f" />
            <stop offset="1" stopColor="#feb47b" />
          </linearGradient>
          <linearGradient id="flame-inner" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#feb47b" />
            <stop offset="1" stopColor="#fff4e0" />
          </linearGradient>
        </defs>
        <path d="M50 4 C62 30 88 44 86 76 C84 102 66 116 50 116 C34 116 16 102 14 78 C12 56 28 46 34 30 C38 44 44 50 50 52 C46 36 44 20 50 4 Z" fill="url(#flame-outer)" />
        <motion.path
          d="M50 50 C58 66 70 74 68 92 C66 106 58 112 50 112 C42 112 34 106 32 94 C30 80 40 74 44 64 C46 70 48 72 50 72 C48 64 47 58 50 50 Z"
          fill="url(#flame-inner)"
          animate={{ scaleY: [1, 1.1, 0.95, 1] }}
          style={{ originY: 1, originX: 0.5 }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      </motion.svg>
    </div>
  );
}
