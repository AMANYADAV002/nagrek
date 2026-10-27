'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer, staggerItem } from '@/lib/motion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const LEGAL_NAV = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/guidelines', label: 'Guidelines' },
  { href: '/refund', label: 'Refunds' },
]

/** Client-safe shell — do not pass Lucide component refs from Server Components. */
export function LegalShell({
  eyebrow,
  title,
  subtitle,
  children,
  activePath,
}: {
  eyebrow: string
  title: string
  subtitle: string
  children: React.ReactNode
  activePath: string
}) {
  return (
    <div className="ambient-bg grain relative min-h-dvh overflow-hidden text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-20 size-80 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl px-[var(--space-gutter)] pb-20 pt-10 md:pt-14">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-8">
          <motion.div variants={staggerItem} className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="glass-soft interactive-press inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back to Nagrek
            </Link>
            <nav className="glass-soft flex flex-wrap gap-1 rounded-full p-1" aria-label="Legal pages">
              {LEGAL_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors',
                    activePath === item.href
                      ? 'bg-sunset text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </motion.div>

          <motion.header variants={fadeUp} className="space-y-4 border-b border-white/10 pb-8">
            <Badge variant="sunset">{eyebrow}</Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              {title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className="font-serif font-normal italic text-sunset">{title.split(' ').slice(-1)}</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">{subtitle}</p>
          </motion.header>

          <motion.div
            variants={fadeUp}
            className="prose-legal space-y-6 text-sm leading-relaxed text-muted-foreground md:text-[15px]"
          >
            {children}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-soft rounded-3xl p-5 md:p-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function LegalCallout({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-white/10 bg-black/25 p-4', className)}>{children}</div>
}
