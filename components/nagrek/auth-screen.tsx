'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, Mail, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fadeScale } from '@/lib/motion'

interface AuthScreenProps {
  onGoogle: () => void | Promise<void>
  onEmail: (email: string) => Promise<{ error: Error | null }>
  onDemo?: () => void
  onBack?: () => void
  isConfigured?: boolean
  bannedNotice?: { reason: string } | null
}

export function AuthScreen({
  onGoogle,
  onEmail,
  onDemo,
  onBack,
  isConfigured = true,
  bannedNotice,
}: AuthScreenProps) {
  const [email, setEmail] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogle = async () => {
    try {
      setError(null)
      setLoadingGoogle(true)
      await onGoogle()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign in failed')
      setLoadingGoogle(false)
    }
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    try {
      setError(null)
      setLoadingEmail(true)
      const res = await onEmail(trimmed)
      if (res?.error) {
        setError(res.error.message)
      } else {
        setSent(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      setLoadingEmail(false)
    }
  }

  return (
    <motion.section
      aria-labelledby="auth-title"
      className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-20 md:px-8"
      variants={fadeScale}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <div className="relative w-full max-w-md">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to welcome
          </button>
        )}

        <Card>
          <CardContent className="pt-8">
            <div className="mb-8 text-center">
              <Badge variant="sunset" className="mb-3 normal-case tracking-[0.12em]">
                <Sparkles className="size-3" /> Step in to join
              </Badge>
              <h2 id="auth-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
                Sign in to <span className="font-serif italic text-sunset">nagrek</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Spontaneous meal connections. Adults 18+ only.</p>
            </div>

            {bannedNotice && (
              <div className="mb-5 rounded-2xl border border-destructive/35 bg-destructive/12 p-4 text-xs">
                <div className="font-semibold text-foreground">Account banned</div>
                <div className="mt-1 text-muted-foreground">{bannedNotice.reason}</div>
                <div className="mt-2 text-[11px] text-foreground/80">
                  Appeal at{' '}
                  <a href="mailto:appeals@nagrek.com" className="font-semibold text-accent underline-offset-2 hover:underline">
                    appeals@nagrek.com
                  </a>
                </div>
              </div>
            )}

            {!isConfigured && (
              <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                Supabase is not configured. Demo guest sign-in will be used.
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            {sent ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto size-12 text-success" />
                <h3 className="mt-3 text-base font-semibold">Check your inbox</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Magic link sent to <strong className="text-foreground">{email}</strong>
                </p>
                <Button variant="ghost" size="sm" className="mt-6" onClick={() => setSent(false)}>
                  Use a different email
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleGoogle}
                  disabled={loadingGoogle || loadingEmail}
                >
                  {loadingGoogle ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <div className="relative my-2 flex items-center justify-center">
                  <span className="absolute inset-x-0 h-px bg-white/10" />
                  <span className="relative rounded-full bg-card/80 px-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                    or email
                  </span>
                </div>

                <form onSubmit={handleEmail} className="space-y-3">
                  <div>
                    <Label htmlFor="auth-email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        disabled={loadingEmail || loadingGoogle}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loadingEmail || loadingGoogle}>
                    {loadingEmail ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Send magic link <ChevronRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              By continuing you agree to our{' '}
              <a href="/terms" className="text-foreground underline-offset-2 hover:underline">
                Terms
              </a>
              ,{' '}
              <a href="/privacy" className="text-foreground underline-offset-2 hover:underline">
                Privacy
              </a>
              , and{' '}
              <a href="/guidelines" className="text-foreground underline-offset-2 hover:underline">
                Guidelines
              </a>
              . You confirm you are 18+.
            </p>

            {onDemo && (
              <div className="mt-5 border-t border-white/10 pt-4 text-center">
                <button type="button" onClick={onDemo} className="text-xs text-muted-foreground hover:text-foreground">
                  Explore first? <span className="text-accent underline-offset-2 hover:underline">Try Demo mode</span>
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.section>
  )
}
