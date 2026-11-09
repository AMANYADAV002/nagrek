"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { motion as tokens } from "@/lib/design-tokens";

export function Stagger({ children, className, delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: tokens.stagger, delayChildren: delay } } }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: tokens.base, ease: tokens.ease } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
