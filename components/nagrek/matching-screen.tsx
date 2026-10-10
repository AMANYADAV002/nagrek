'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CameraOff, RotateCw, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { MediaIssue, Mode, SearchStatus } from '@/hooks/use-nagrek-session'
import type { Food } from '@/lib/foods'
import { MagneticButton } from './magnetic-button'
import { VideoTile } from './video-tile'

interface MatchingScreenProps {
  food: Food
  region: string
  mode: Mode
  status: SearchStatus
  mediaIssue: MediaIssue
  localStream: MediaStream | null
  onRetry: () => void
  onDemo: () => void
  onBack: () => void
}

const MEDIA_COPY: Record<Exclude<MediaIssue, null>, string> = {
  denied: 'Camera access was blocked, so we switched you to demo mode.',
  'not-found': 'No camera found on this device — running in demo mode.',
  insecure: 'Live video needs HTTPS. Running in demo mode for now.',
  unavailable: 'Your camera is busy or unavailable — running in demo mode.',
}

const DOTS = [
  { x: -150, y: -60, d: 0.2 },
  { x: 120, y: -120, d: 1.1 },
  { x: 160, y: 70, d: 2.1 },
  { x: -90, y: 140, d: 2.8 },
  { x: -170, y: 40, d: 3.6 },
  { x: 40, y: 165, d: 1.6 },
]

export function MatchingScreen({
  food,
  region,
  mode,
  status,
  mediaIssue,
  localStream,
  onRetry,
  onDemo,
  onBack,
}: MatchingScreenProps) {
  const [elapsed, setElapsed] = useState(0)
  const timedOut = status === 'timeout'

  useEffect(() => {
    setElapsed(0)
    if (timedOut) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [timedOut, status])

  const headline =
    status === 'requesting-media'
      ? 'Warming up your camera'
      : status === 'connecting'
        ? 'Setting the table'
        : timedOut
          ? 'The table is quiet'
          : mode === 'demo'
            ? 'Finding a demo partner'
            : 'Looking for your'

  const sub =
    status === 'requesting-media'
      ? 'Allow camera and mic so your match can see you.'
      : status === 'connecting'
        ? 'Connecting to the Nagrek server…'
        : timedOut
          ? `Nobody in ${region} is craving ${food.label.toLowerCase()} right now. Try again, or preview with a demo partner.`
          : `Someone in ${region} who's also craving ${food.label.toLowerCase()}.`

  return (
    <motion.section
      key="matching"
      aria-labelledby="matching-title"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-12 pt-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative flex size-[min(78vw,420px)] items-center justify-center" aria-hidden="true">
        {[1, 0.74, 0.48].map((s) => (
          <div key={s} className="absolute rounded-full border border-white/[0.07]" style={{ width: `${s * 100}%`, height: `${s * 100}%` }} />
        ))}

        {!timedOut && (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,126,95,0.35) 50deg, transparent 90deg)',
                animation: 'radar-sweep 3.2s linear infinite',
                maskImage: 'radial-gradient(circle, black 30%, transparent 71%)',
                WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 71%)',
              }}
            />
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute size-1/2 rounded-full border border-primary/50"
                style={{ animation: `ping-ring 3s ease-out ${i}s infinite` }}
              />
            ))}
            {DOTS.map((dot, i) => (
              <motion.span
                key={i}
                className="absolute size-2.5 rounded-full bg-accent shadow-[0_0_14px_rgba(254,180,123,0.9)]"
                style={{ x: dot.x * 0.85, y: dot.y * 0.85 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
                transition={{ duration: 3.2, delay: dot.d, repeat: Number.POSITIVE_INFINITY }}
              />
            ))}
          </>
        )}

        <motion.div
          layoutId={`food-${food.id}`}
          className="relative size-[38%] overflow-hidden rounded-full border-2 border-white/15 shadow-[0_0_80px_-10px_rgba(255,126,95,0.7)]"
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <Image src={food.image || '/placeholder.svg'} alt="" fill sizes="200px" className="object-cover" priority />
        </motion.div>
      </div>

      <div className="relative z-10 mt-10 flex max-w-xl flex-col items-center text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Step 02 / 03 {!timedOut && <span className="text-muted-foreground">· {formatElapsed(elapsed)}</span>}
        </p>
        <AnimatePresence mode="wait">
          <motion.h2
            key={headline}
            id="matching-title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            className="text-balance text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-6xl"
          >
            {headline}{' '}
            {status === 'searching' && mode === 'live' && (
              <span className="font-serif font-normal italic text-sunset">{food.label.toLowerCase()} buddy</span>
            )}
          </motion.h2>
        </AnimatePresence>
        <p className="mt-4 text-pretty text-muted-foreground" aria-live="polite">
          {sub}
        </p>

        {mediaIssue && (
          <p className="glass mt-6 flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm text-foreground/90">
            <CameraOff className="size-4 shrink-0 text-accent" aria-hidden="true" />
            {MEDIA_COPY[mediaIssue]}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {timedOut ? (
            <>
              <MagneticButton onClick={onRetry}>
                <RotateCw className="size-4" aria-hidden="true" />
                Search again
              </MagneticButton>
              <MagneticButton variant="glass" onClick={onDemo}>
                <Sparkles className="size-4" aria-hidden="true" />
                Try demo
              </MagneticButton>
            </>
          ) : (
            mode === 'live' &&
            status === 'searching' &&
            elapsed >= 6 && (
              <MagneticButton variant="glass" size="md" onClick={onDemo}>
                <Sparkles className="size-4" aria-hidden="true" />
                Skip the wait — try demo
              </MagneticButton>
            )
          )}
          <MagneticButton variant="ghost" size="md" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Change craving
          </MagneticButton>
        </div>
      </div>

      {localStream && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed bottom-5 right-5 z-20 aspect-[3/4] w-24 overflow-hidden rounded-2xl border border-white/15 shadow-2xl md:w-36"
        >
          <VideoTile stream={localStream} muted mirrored label="Your camera preview" />
        </motion.div>
      )}
    </motion.section>
  )
}

function formatElapsed(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
