'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, X } from 'lucide-react'
import { MagneticButton } from './magnetic-button'

export function PostCallRating({
  onRate,
  onDismiss,
}: {
  onRate: (rating: number) => void | Promise<void>
  onDismiss: () => void
}) {
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)

  const pick = async (n: number) => {
    setSaving(true)
    try {
      await onRate(n)
      onDismiss()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <motion.button
        type="button"
        aria-label="Dismiss rating"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <motion.div
        role="dialog"
        aria-labelledby="post-call-rating-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/15 bg-card/95 p-6 shadow-2xl backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Rate the conversation</p>
        <h2 id="post-call-rating-title" className="mt-2 text-xl font-semibold tracking-tight">
          How was that chat?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rate the conversation (1–5). Liked them? Add as friend next — then share Insta / Snap / FB / LinkedIn.
        </p>
        <div className="mt-5 flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              aria-label={`Rate ${n} stars`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => pick(n)}
              className="rounded-full p-2 transition-transform hover:scale-110 disabled:opacity-50"
            >
              <Star
                className={`size-7 ${hover >= n ? 'fill-accent text-accent' : 'text-muted-foreground'}`}
              />
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <MagneticButton variant="glass" size="md" onClick={onDismiss} disabled={saving}>
            Skip
          </MagneticButton>
        </div>
      </motion.div>
    </div>
  )
}
