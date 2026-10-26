import type { Transition, Variants } from 'framer-motion'

export const easeOutExpo: Transition['ease'] = [0.22, 1, 0.36, 1]

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
  },
  exit: { opacity: 0, y: 10, transition: { duration: 0.25 } },
}

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: easeOutExpo },
  },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOutExpo },
  },
}

export const softSpring = { type: 'spring' as const, stiffness: 380, damping: 28 }
