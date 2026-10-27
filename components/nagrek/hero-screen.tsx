'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { FOODS } from '@/lib/foods'
import { FaqSection } from './faq-section'
import { MagneticButton } from './magnetic-button'
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
  return (
    <motion.section
      key="hero"
      aria-labelledby="hero-title"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {FOODS.slice(0, 4).map((food, i) => (
        <div
          key={food.id}
          className={`pointer-events-none absolute hidden sm:block ${FLOAT_POSITIONS[i]}`}
          style={{ opacity: 0.9 }}
        >
          <div className="relative size-24 overflow-hidden rounded-full border border-white/10 shadow-2xl shadow-black/60 md:size-32 lg:size-36">
            <Image
              src={food.image || '/placeholder.svg'}
              alt=""
              fill
              sizes="144px"
              className="object-cover"
              priority={i < 2}
            />
          </div>
        </div>
      ))}

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          Shared cravings · real people
        </p>

        <h1
          id="hero-title"
          className="text-balance text-[clamp(3.5rem,13vw,10.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]"
        >
          <span className="block">Never</span>
          <span className="block font-serif font-normal italic tracking-[-0.03em] text-sunset">
            eat alone.
          </span>
        </h1>

        <p className="mt-8 max-w-md text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Pick what you&apos;re craving. When someone nearby wants the same, you meet over a 1-on-1 video call.
          Empty queue? Try Demo — always labeled, never sold as a real person.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <MagneticButton size="xl" onClick={onStart} className="group" strength={0.12}>
            Find a meal buddy
            <ArrowRight
              className="size-5 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </MagneticButton>
          <WaitlistForm source="hero" cityPlaceholder="Bengaluru?" />
        </div>

        <ol className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          {STEPS.map((step) => (
            <li key={step.n} className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent">{step.n}</span>
              {step.label}
            </li>
          ))}
        </ol>
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
        <a href="/ambassador" className="transition-colors hover:text-foreground">
          Ambassadors
        </a>
      </footer>
    </motion.section>
  )
}
