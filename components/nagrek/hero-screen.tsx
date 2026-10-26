'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useEffect } from 'react'
import { FOODS } from '@/lib/foods'
import { FaqSection } from './faq-section'
import { MagneticButton } from './magnetic-button'
import { SplitReveal } from './split-reveal'
import { WaitlistForm } from './waitlist-form'

const FLOAT_POSITIONS = [
  'left-[4%] top-[18%] md:left-[8%] md:top-[20%]',
  'right-[6%] top-[14%] md:right-[10%] md:top-[18%]',
  'left-[8%] bottom-[14%] md:left-[14%] md:bottom-[16%]',
  'right-[4%] bottom-[18%] md:right-[12%] md:bottom-[14%]',
]

const STEPS = [
  { n: '01', label: 'Pick a craving' },
  { n: '02', label: 'Match nearby' },
  { n: '03', label: 'Eat together' },
]

export function HeroScreen({ onStart }: { onStart: () => void }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const smx = useSpring(mx, { stiffness: 60, damping: 20 })
  const smy = useSpring(my, { stiffness: 60, damping: 20 })
  const farX = useTransform(smx, (v) => v * 40)
  const farY = useTransform(smy, (v) => v * 40)
  const nearX = useTransform(smx, (v) => v * -22)
  const nearY = useTransform(smy, (v) => v * -22)

  useEffect(() => {
    const move = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5)
      my.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [mx, my])

  return (
    <motion.section
      key="hero"
      aria-labelledby="hero-title"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28"
      exit={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {FOODS.slice(0, 4).map((food, i) => (
        <motion.div
          key={food.id}
          className={`absolute hidden sm:block ${FLOAT_POSITIONS[i]}`}
          style={{ x: i % 2 ? nearX : farX, y: i % 2 ? nearY : farY }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 + i * 0.12, duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            layoutId={`food-${food.id}`}
            className="relative size-24 overflow-hidden rounded-full border border-white/10 shadow-2xl shadow-black/60 md:size-32 lg:size-36"
            animate={{ y: [0, i % 2 ? 14 : -14, 0], rotate: [0, i % 2 ? 4 : -4, 0] }}
            transition={{ duration: 6 + i, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          >
            <Image src={food.image || '/placeholder.svg'} alt="" fill sizes="144px" className="object-cover" priority={i < 2} />
          </motion.div>
        </motion.div>
      ))}

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          Shared cravings · real people
        </motion.p>

        <h1 id="hero-title" className="text-balance text-[clamp(3.5rem,13vw,10.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">
          <SplitReveal text="Never" className="block" delay={0.15} />
          <SplitReveal text="eat alone." className="block font-serif font-normal italic tracking-[-0.03em] text-sunset" delay={0.4} />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="mt-8 max-w-md text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Pick what you&apos;re craving. When someone nearby wants the same, you meet over a 1-on-1 video call.
          Empty queue? Try Demo — always labeled, never sold as a real person.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.8 }}
          className="mt-10 flex flex-col items-center gap-4"
        >
          <MagneticButton size="xl" onClick={onStart} className="group">
            Find a meal buddy
            <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
          </MagneticButton>
          <WaitlistForm source="hero" cityPlaceholder="Bengaluru?" />
        </motion.div>

        <motion.ol
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 1 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
        >
          {STEPS.map((step) => (
            <li key={step.n} className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent">{step.n}</span>
              {step.label}
            </li>
          ))}
        </motion.ol>
      </div>

      <div className="relative z-10 mt-24 w-full">
        <FaqSection />
      </div>

      <footer className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-10 text-xs text-muted-foreground">
        <a href="/privacy" className="transition-colors hover:text-foreground">
          Privacy
        </a>
        <a href="/terms" className="transition-colors hover:text-foreground">
          Terms
        </a>
        <a href="/guidelines" className="transition-colors hover:text-foreground">
          Guidelines
        </a>
        <a href="/refund" className="transition-colors hover:text-foreground">
          Refunds
        </a>
        <a href="/bengaluru" className="transition-colors hover:text-foreground">
          Bengaluru
        </a>
      </footer>
    </motion.section>
  )
}
