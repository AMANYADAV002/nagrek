'use client'

import { motion } from 'framer-motion'
import { Calendar, CheckCircle2, CreditCard, Loader2, Mail, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SubscriptionData } from '@/hooks/use-subscription'
import { Input } from '@/components/ui/input'
import { normalizeSocialHandles } from '@/lib/social-links'

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
  displayName?: string
  username?: string | null
  email?: string
  social?: {
    instagram?: string | null
    snapchat?: string | null
    facebook?: string | null
    linkedin?: string | null
  }
  subscription: SubscriptionData | null
  invitePath?: string
  onCancelSubscription: () => Promise<{ success: boolean; status: string; end_date: string | null }>
  onSaveSocial?: (handles: {
    instagram: string | null
    snapchat: string | null
    facebook: string | null
    linkedin: string | null
  }) => Promise<{ error: Error | null }>
  onOpenPaywall?: () => void
}

export function AccountModal({
  isOpen,
  onClose,
  displayName,
  username,
  email,
  social,
  subscription,
  invitePath,
  onCancelSubscription,
  onSaveSocial,
  onOpenPaywall,
}: AccountModalProps) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [instagram, setInstagram] = useState(social?.instagram || '')
  const [snapchat, setSnapchat] = useState(social?.snapchat || '')
  const [facebook, setFacebook] = useState(social?.facebook || '')
  const [linkedin, setLinkedin] = useState(social?.linkedin || '')
  const [savingSocial, setSavingSocial] = useState(false)
  const [socialSaved, setSocialSaved] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setInstagram(social?.instagram || '')
    setSnapchat(social?.snapchat || '')
    setFacebook(social?.facebook || '')
    setLinkedin(social?.linkedin || '')
  }, [isOpen, social?.instagram, social?.snapchat, social?.facebook, social?.linkedin])

  if (!isOpen) return null

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel? You will keep access until the end of your current billing period.')) {
      return
    }
    try {
      setCancelling(true)
      setError(null)
      const res = await onCancelSubscription()
      const endStr = res.end_date
        ? new Date(res.end_date).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : 'end of cycle'
      setCancelResult(`Subscription cancelled. You retain full access until ${endStr}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setCancelling(false)
    }
  }

  const periodEndStr = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  const planName =
    subscription?.plan === 'trial'
      ? '7-Day Free Trial'
      : subscription?.plan === 'm1'
        ? 'Monthly Membership (₹149/mo)'
        : subscription?.plan === 'm3'
          ? '3 Months Pass (₹399)'
          : subscription?.plan === 'm6'
            ? '6 Months Pass (₹699)'
            : 'No active plan'

  const isCancelled = subscription?.status === 'cancelled'
  const isActive = subscription?.status === 'active' || subscription?.status === 'trial'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal Box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="glass relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl backdrop-blur-2xl md:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-sunset text-base font-bold text-primary-foreground">
            {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{displayName || 'User'}</h2>
            <p className="text-xs text-muted-foreground">
              {username ? `@${username}` : ''} {email ? `· ${email}` : ''}
            </p>
          </div>
        </div>

        {onSaveSocial && (
          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-medium text-foreground">Social handles for friends</p>
            <p className="text-[11px] text-muted-foreground">
              Visible only after both of you accept a friend request.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" />
              <Input value={snapchat} onChange={(e) => setSnapchat(e.target.value)} placeholder="Snapchat" />
              <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook" />
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="LinkedIn" />
            </div>
            <button
              type="button"
              disabled={savingSocial}
              onClick={async () => {
                setSavingSocial(true)
                setError(null)
                try {
                  const handles = normalizeSocialHandles({ instagram, snapchat, facebook, linkedin })
                  const res = await onSaveSocial(handles)
                  if (res.error) throw res.error
                  setSocialSaved(true)
                  setTimeout(() => setSocialSaved(false), 2000)
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : 'Could not save handles')
                } finally {
                  setSavingSocial(false)
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
            >
              {savingSocial ? <Loader2 className="size-3.5 animate-spin" /> : socialSaved ? 'Saved' : 'Save socials'}
            </button>
          </div>
        )}

        {invitePath && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="mb-2 text-xs text-muted-foreground">Invite link (extra trial days when billing ships)</p>
            <button
              type="button"
              className="w-full truncate rounded-xl bg-white/5 px-3 py-2 text-left text-xs text-foreground hover:bg-white/10"
              onClick={async () => {
                const url = `${window.location.origin}${invitePath}`
                try {
                  await navigator.clipboard.writeText(url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  /* ignore */
                }
              }}
            >
              {copied ? 'Copied!' : invitePath}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {cancelResult && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-success/20 bg-success/10 p-3 text-xs text-success">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <span>{cancelResult}</span>
          </div>
        )}

        {/* Subscription Info Card */}
        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Current Plan</span>
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-sunset" /> {planName}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
            <span className="text-xs text-muted-foreground">Status</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isActive && !isCancelled
                  ? 'bg-success/20 text-success'
                  : isCancelled
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {subscription?.status || 'None'}
            </span>
          </div>

          {periodEndStr && (
            <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
              <span className="text-muted-foreground">
                {isCancelled ? 'Access ends on' : 'Renewal date'}
              </span>
              <span className="font-medium text-foreground flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground" /> {periodEndStr}
              </span>
            </div>
          )}
        </div>

        {/* Invoices Note */}
        <div className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Mail className="size-3.5 text-sunset shrink-0 mt-0.5" />
          <span>
            Tax invoices & payment receipts are emailed automatically via Razorpay after every charge.
          </span>
        </div>

        {/* Privacy & Data Rights */}
        <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-muted-foreground space-y-1.5">
          <div className="flex items-center justify-between text-white font-medium text-xs">
            <span>Privacy & Your Data</span>
            <a href="/privacy" target="_blank" className="text-sunset underline hover:opacity-85">
              Read Policy
            </a>
          </div>
          <p className="leading-relaxed">
            Data held: login, 0.1° fuzzy location cell, and match timestamps. Calls are strictly peer-to-peer and never recorded.
          </p>
          <p className="leading-relaxed">
            To withdraw consent or request full data deletion, email our data protection team at{' '}
            <a href="mailto:privacy@nagrek.com" className="text-white underline">
              privacy@nagrek.com
            </a>
            .
          </p>
        </div>

        {/* 1-Tap Cancel Button */}
        <div className="mt-6 space-y-2">
          {isActive && !isCancelled && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 active:scale-[0.98] disabled:opacity-50"
            >
              {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : '1-Tap Cancel Subscription'}
            </button>
          )}

          {(!isActive || isCancelled) && onOpenPaywall && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenPaywall()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sunset py-2.5 text-xs font-semibold text-primary-foreground transition-transform hover:opacity-95"
            >
              <Sparkles className="size-3.5" /> Renew or Change Plan
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
