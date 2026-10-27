import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AmbassadorForm } from '@/components/nagrek/ambassador-form'

export const metadata: Metadata = {
  title: 'Campus ambassadors — Nagrek',
  description: 'Bring Nagrek lunch and dinner windows to your campus. Apply as a campus ambassador.',
}

export default function AmbassadorPage() {
  return (
    <div className="ambient-bg grain relative min-h-dvh overflow-hidden text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-28 size-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-16 size-80 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col gap-8 px-5 pb-20 pt-12 md:px-10 md:pt-16">
        <Link
          href="/"
          className="glass-soft inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to Nagrek
        </Link>

        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
            <Sparkles className="size-3.5" /> Growth
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
            Campus <span className="font-serif font-normal italic text-sunset">ambassadors</span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Host meal windows, invite classmates, and help people never eat alone. No paid outreach until owner
            approves GATE-G7 — this form only collects interest.
          </p>
        </div>

        <AmbassadorForm />
      </div>
    </div>
  )
}
