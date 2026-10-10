'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import type { Mode, Stage } from '@/hooks/use-nagrek-session'

interface SiteHeaderProps {
  stage: Stage
  mode: Mode
  region: string
  socketConnected: boolean
  onHome: () => void
}

export function SiteHeader({ stage, mode, region, socketConnected, onHome }: SiteHeaderProps) {
  const showStatus = stage === 'matching' || stage === 'video'
  const live = mode === 'live' && socketConnected

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1.25rem)] md:px-10">
      <button
        type="button"
        onClick={onHome}
        data-cursor="hover"
        className="group flex items-center gap-2.5 rounded-full py-1 pr-2 focus-visible:outline-2 focus-visible:outline-offset-4"
        aria-label="Nagrek — back to start"
      >
        <span className="relative flex h-7 w-11 items-center" aria-hidden="true">
          <span className="absolute left-0 size-7 rounded-full border-[2.5px] border-primary transition-transform duration-500 group-hover:-translate-x-0.5" />
          <span className="absolute right-0 size-7 rounded-full border-[2.5px] border-accent transition-transform duration-500 group-hover:translate-x-0.5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">nagrek</span>
      </button>

      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass flex items-center gap-3 rounded-full px-4 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span
                  className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${live ? 'bg-success' : 'bg-accent'}`}
                />
                <span className={`relative inline-flex size-2 rounded-full ${live ? 'bg-success' : 'bg-accent'}`} />
              </span>
              <span className="font-medium uppercase tracking-[0.14em]">{mode === 'demo' ? 'Demo' : live ? 'Live' : 'Connecting'}</span>
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {region}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
