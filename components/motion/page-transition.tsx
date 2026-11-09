"use client";

import { motion } from "framer-motion";
import { motion as tokens } from "@/lib/design-tokens";

/** Used from template.tsx files so every navigation re-runs the enter animation. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: tokens.base, ease: tokens.ease }}
    >
      {children}
    </motion.div>
  );
}
