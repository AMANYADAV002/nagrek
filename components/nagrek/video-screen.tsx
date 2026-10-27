'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Ban,
  Check,
  Flag,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  ShieldAlert,
  SkipForward,
  User,
  UserPlus,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { DECISION_WINDOW_S, type MatchState, type Mode } from '@/hooks/use-nagrek-session'
import { icebreakersFor, type Food } from '@/lib/foods'
import { cn } from '@/lib/utils'
import { MagneticButton } from './magnetic-button'
import { VideoTile } from './video-tile'

const REPORT_REASONS = [
  'Underage / Minor',
  'Inappropriate behavior / Nudity',
  'Harassment or hate speech',
  'Spam or commercial advertising',
  'Other safety violation',
]

interface VideoScreenProps {
  food: Food
  region: string
  mode: Mode
  match: MatchState
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  onAccept: () => void
  onSkip: (reason?: 'skip' | 'timeout') => void
  onLeave: () => void
  onReport?: (reason: string) => void
  onBlock?: () => void
  onAddFriend?: () => void
  onRate?: (rating: number) => void
}

export function VideoScreen({
  food,
  region,
  mode,
  match,
  localStream,
  remoteStream,
  onAccept,
  onSkip,
  onLeave,
  onReport,
  onBlock,
  onAddFriend,
  onRate,
}: VideoScreenProps) {
  const [remaining, setRemaining] = useState(DECISION_WINDOW_S)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])
  const [submittingReport, setSubmittingReport] = useState(false)
  const [friendSent, setFriendSent] = useState(false)
  const [rated, setRated] = useState(false)
  const prompts = icebreakersFor(food.id)
  const prompt = prompts[Math.floor((match.roomId?.length || 0) % prompts.length)] || prompts[0]

  useEffect(() => {
    setRemaining(DECISION_WINDOW_S)
  }, [match.roomId])

  useEffect(() => {
    if (match.bothAccepted) return
    if (remaining <= 0) {
      onSkip('timeout')
      return
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, match.bothAccepted, onSkip])

  useEffect(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = micOn))
  }, [localStream, micOn])
  useEffect(() => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = camOn))
  }, [localStream, camOn])

  const deciding = !match.bothAccepted
  const progress = remaining / DECISION_WINDOW_S

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportReason || submittingReport) return
    setSubmittingReport(true)
    try {
      if (onReport) {
        onReport(reportReason)
      } else {
        onSkip('skip')
      }
    } finally {
      setSubmittingReport(false)
      setShowReportModal(false)
    }
  }

  const handleBlockConfirm = () => {
    setShowBlockModal(false)
    if (onBlock) {
      onBlock()
    } else {
      onSkip('skip')
    }
  }

  return (
    <motion.section
      key="video"
      aria-labelledby="video-title"
      className="relative flex min-h-dvh flex-col px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-24 md:px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <motion.div layoutId={`food-${food.id}`} className="relative size-11 shrink-0 overflow-hidden rounded-full border border-white/15">
            <Image src={food.image || '/placeholder.svg'} alt="" fill sizes="44px" className="object-cover" />
          </motion.div>
          <div className="min-w-0">
            <h2 id="video-title" className="truncate text-lg font-semibold tracking-tight md:text-xl">
              {match.bothAccepted ? (
                <>
                  Enjoy your <span className="font-serif font-normal italic text-sunset">{food.label.toLowerCase()}</span>
                </>
              ) : (
                <>
                  Matched over <span className="font-serif font-normal italic text-sunset">{food.label.toLowerCase()}</span>
                </>
              )}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {region}
              {mode === 'demo' ? ' · Demo (not a real person)' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
            title="Report this user"
            aria-label="Report this user"
          >
            <Flag className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Report</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            title="Block this user"
            aria-label="Block this user"
          >
            <Ban className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Block</span>
          </button>
          {deciding && <CountdownRing remaining={remaining} progress={progress} />}
        </div>
      </div>

      <div className="relative grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-h-[52dvh] overflow-hidden rounded-3xl border border-white/10 bg-muted md:min-h-0"
        >
          <RemoteView mode={mode} stream={remoteStream} connected={match.connected} muted={deciding} blurred={deciding} />
          <TileBadge>
            {mode === 'demo' ? (
              <span className="text-accent">Demo partner</span>
            ) : match.partnerAccepted ? (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="size-3.5" aria-hidden="true" /> They&apos;re in
              </span>
            ) : (
              'Your match'
            )}
          </TileBadge>
          {match.bothAccepted && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
              <p className="glass rounded-2xl px-3 py-2 text-center text-xs text-foreground/90 md:text-sm">
                Icebreaker: {prompt}
              </p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-3 top-3 z-10 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-white/15 bg-muted shadow-2xl sm:w-36 md:relative md:right-auto md:top-auto md:aspect-auto md:w-auto md:rounded-3xl md:shadow-none"
        >
          {localStream && camOn ? (
            <VideoTile stream={localStream} muted mirrored label="Your camera" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-glass-strong md:size-20">
                <User className="size-5 md:size-8" aria-hidden="true" />
              </span>
              <span className="hidden text-sm md:block">{localStream ? 'Camera off' : 'No camera'}</span>
            </div>
          )}
          <TileBadge className="hidden md:flex">
            {match.selfAccepted ? (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="size-3.5" aria-hidden="true" /> You&apos;re in
              </span>
            ) : (
              'You'
            )}
          </TileBadge>
        </motion.div>

        <AnimatePresence>
          {match.bothAccepted && (
            <motion.div
              key="celebrate"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 1.05] }}
              transition={{ duration: 2.2, times: [0, 0.15, 0.8, 1] }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
              aria-hidden="true"
            >
              <span className="glass rounded-full px-6 py-3 text-lg font-semibold">
                Bon appétit <span className="font-serif font-normal italic text-sunset">together</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3" role="toolbar" aria-label="Call controls">
        {deciding ? (
          <>
            <MagneticButton variant="danger" onClick={() => onSkip('skip')} aria-label="Skip this match">
              <X className="size-5" aria-hidden="true" />
              Skip
            </MagneticButton>
            <MagneticButton
              variant="success"
              onClick={onAccept}
              disabled={match.selfAccepted}
              className="min-w-44"
              aria-label={match.selfAccepted ? 'Waiting for your match to accept' : 'Accept this match'}
            >
              {match.selfAccepted ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  Waiting for them
                </>
              ) : (
                <>
                  <Check className="size-5" aria-hidden="true" />
                  Accept
                </>
              )}
            </MagneticButton>
          </>
        ) : (
          <>
            <IconToggle on={micOn} onChange={setMicOn} onIcon={Mic} offIcon={MicOff} label="microphone" disabled={!localStream} />
            <IconToggle on={camOn} onChange={setCamOn} onIcon={Video} offIcon={VideoOff} label="camera" disabled={!localStream} />
            {mode !== 'demo' && onAddFriend && match.partnerUserId && (
              <MagneticButton
                variant="glass"
                disabled={friendSent}
                onClick={() => {
                  onAddFriend()
                  setFriendSent(true)
                }}
              >
                <UserPlus className="size-5" aria-hidden="true" />
                {friendSent ? 'Request sent' : 'Add friend'}
              </MagneticButton>
            )}
            {onRate && !rated && (
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="size-8 rounded-full text-sm hover:bg-white/10"
                    aria-label={`Rate ${n}`}
                    onClick={() => {
                      onRate(n)
                      setRated(true)
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <MagneticButton variant="glass" onClick={() => onSkip('skip')}>
              <SkipForward className="size-5" aria-hidden="true" />
              Next
            </MagneticButton>
            <MagneticButton variant="danger" onClick={onLeave}>
              <LogOut className="size-5" aria-hidden="true" />
              Leave
            </MagneticButton>
          </>
        )}
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-card/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                  <ShieldAlert className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Report User</h3>
                  <p className="text-xs text-muted-foreground">Select the reason for reporting this user.</p>
                </div>
              </div>

              <form onSubmit={handleReportSubmit} className="mt-5 space-y-4">
                <div className="space-y-2">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs font-medium transition',
                        reportReason === r
                          ? 'border-sunset/50 bg-sunset/10 text-white'
                          : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-white',
                      )}
                    >
                      <span>{r}</span>
                      <input
                        type="radio"
                        name="reportReason"
                        checked={reportReason === r}
                        onChange={() => setReportReason(r)}
                        className="size-4 accent-[#ff7e5f]"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-destructive/90"
                  >
                    {submittingReport && <Loader2 className="size-3.5 animate-spin" />}
                    Submit & Skip
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Block Modal */}
      <AnimatePresence>
        {showBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBlockModal(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 bg-card/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                  <Ban className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Block User</h3>
                  <p className="text-xs text-muted-foreground">Permanent block confirmation</p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                You will immediately disconnect and will <span className="font-semibold text-white">never</span> be matched with this user again.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBlockConfirm}
                  className="rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-destructive/90"
                >
                  Block & Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function RemoteView({
  mode,
  stream,
  connected,
  muted,
  blurred,
}: {
  mode: Mode
  stream: MediaStream | null
  connected: boolean
  muted: boolean
  blurred: boolean
}) {
  if (mode === 'demo') {
    return (
      <div className="relative size-full overflow-hidden">
        <motion.div
          className="absolute inset-0"
          animate={{ scale: [1.04, 1.12, 1.04] }}
          transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        >
          <Image
            src="/images/demo-partner.webp"
            alt="Demo partner enjoying a meal"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className={cn(
              'object-cover transition-[filter,transform] duration-700 ease-out',
              blurred && 'scale-110 blur-2xl brightness-90 saturate-75',
            )}
            priority
          />
        </motion.div>
        {blurred && <BlurNotice />}
      </div>
    )
  }
  if (stream) {
    return (
      <div className="relative size-full overflow-hidden">
        <VideoTile stream={stream} muted={muted} blurred={blurred} label="Your match's video" className="absolute inset-0" />
        {blurred && <BlurNotice />}
      </div>
    )
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">{connected ? 'Waiting for video…' : 'Connecting video…'}</p>
    </div>
  )
}

function BlurNotice() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex items-end justify-center bg-black/20 p-6 text-center">
      <p className="glass rounded-full px-4 py-1.5 text-xs font-medium text-foreground">
        Accept to reveal video
      </p>
    </div>
  )
}

function TileBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('glass absolute bottom-3 left-3 flex items-center rounded-full px-3 py-1.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}

function CountdownRing({ remaining, progress }: { remaining: number; progress: number }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center" role="timer" aria-label={`${remaining} seconds to decide`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={remaining <= 3 ? 'var(--destructive)' : 'var(--accent)'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="font-mono text-sm font-semibold tabular-nums">{remaining}</span>
    </div>
  )
}

function IconToggle({
  on,
  onChange,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
  disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  onIcon: typeof Mic
  offIcon: typeof Mic
  label: string
  disabled?: boolean
}) {
  return (
    <MagneticButton
      variant="glass"
      className={cn('w-14 px-0', !on && 'border-destructive/50 text-destructive')}
      onClick={() => onChange(!on)}
      aria-pressed={!on}
      aria-label={on ? `Turn ${label} off` : `Turn ${label} on`}
      disabled={disabled}
    >
      {on ? <OnIcon className="size-5" aria-hidden="true" /> : <OffIcon className="size-5" aria-hidden="true" />}
    </MagneticButton>
  )
}
