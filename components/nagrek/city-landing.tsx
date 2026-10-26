'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, MapPin } from 'lucide-react'
import { WaitlistForm } from '@/components/nagrek/waitlist-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fadeUp, staggerContainer, staggerItem } from '@/lib/motion'

export function CityLanding({
  city,
  source,
  headlineCity,
}: {
  city: string
  source: string
  headlineCity: string
}) {
  return (
    <main className="ambient-bg grain relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/20 to-transparent"
      />
      <motion.div
        className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-[var(--space-gutter)] py-24"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <Badge variant="sunset" className="mb-5">
            <MapPin className="size-3.5" /> {city}
          </Badge>
        </motion.div>
        <motion.h1 variants={fadeUp} className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
          Never eat alone in <span className="font-serif font-normal italic text-sunset">{headlineCity}</span>
        </motion.h1>
        <motion.p
          variants={staggerItem}
          className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Match over biryani, dosa, chai, or pizza during lunch and dinner windows (IST). Real 1-on-1 video — Demo
          partners are always labeled Demo.
        </motion.p>
        <motion.div variants={staggerItem} className="mt-10">
          <WaitlistForm source={source} cityPlaceholder="Area / college" />
        </motion.div>
        <motion.div variants={staggerItem} className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/">
            <Button>
              Open the app <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link
            href="/guidelines"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Community guidelines
          </Link>
        </motion.div>
      </motion.div>
    </main>
  )
}
