'use client'

import { motion } from 'framer-motion'
import { Check, CheckCircle2, ChevronRight, Clock, HelpCircle, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PlanKey } from '@/hooks/use-subscription'

interface PlanOption {
  id: PlanKey
  name: string
  price: number
  period: string
  months: number
  days: number
  badge?: string
  description: string
  features: string[]
}

const PLANS: PlanOption[] = [
  {
    id: 'trial',
    name: '7-Day Free Trial',
    price: 0,
    period: 'for 7 days',
    months: 0,
    days: 7,
    badge: 'Try Free',
    description: 'Full access for 7 days. Cancel anytime before renewal.',
    features: ['Unlimited live dining matches', 'Coarse location cell matching', 'High-definition WebRTC video'],
  },
  {
    id: 'm1',
    name: 'Monthly Membership',
    price: 149,
    period: '/ month',
    months: 1,
    days: 30,
    description: 'Billed monthly. Auto-renews unless cancelled.',
    features: ['Unlimited matching', 'All cravings included', 'Region & distance preferences'],
  },
  {
    id: 'm3',
    name: '3 Months Pass',
    price: 399,
    period: 'for 3 months (₹133/mo)',
    months: 3,
    days: 90,
    badge: 'Popular',
    description: 'Save 11% compared to monthly.',
    features: ['All monthly features', 'Priority matchmaking queue', 'Friend list & direct calling'],
  },
  {
    id: 'm6',
    name: '6 Months Pass',
    price: 699,
    period: 'for 6 months (₹116/mo)',
    months: 6,
    days: 180,
    badge: 'Best Value',
    description: 'Save 22% compared to monthly.',
    features: ['All 3-month features', 'Highest priority queue', 'Early access to new cravings'],
  },
]

interface PaywallScreenProps {
  onSubscribe: (plan: PlanKey) => Promise<{
    subscription_id: string
    plan: PlanKey
    test_mode: boolean
    key_id: string
  }>
  onSuccess: () => void
  onDemo?: () => void
}

export function PaywallScreen({ onSubscribe, onSuccess, onDemo }: PaywallScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('trial')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentPlan = useMemo(() => PLANS.find((p) => p.id === selectedPlan) || PLANS[0], [selectedPlan])

  // Compute exact renewal date to display BEFORE pay
  const renewalDateString = useMemo(() => {
    const d = new Date()
    if (currentPlan.days > 0) {
      d.setDate(d.getDate() + currentPlan.days)
    } else {
      d.setMonth(d.getMonth() + currentPlan.months)
    }
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [currentPlan])

  // Load Razorpay script dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!document.getElementById('razorpay-checkout-script')) {
      const script = document.createElement('script')
      script.id = 'razorpay-checkout-script'
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const handleCheckout = async () => {
    try {
      setLoading(true)
      setError(null)
      setStatusMessage('Creating subscription session…')

      const subData = await onSubscribe(selectedPlan)

      // Test Mode handling
      if (subData.test_mode || typeof (window as any).Razorpay === 'undefined') {
        setStatusMessage('Test mode: Completing payment…')
        await new Promise((r) => setTimeout(r, 800))
        setStatusMessage('Payment confirmed!')
        await new Promise((r) => setTimeout(r, 400))
        onSuccess()
        return
      }

      // Live Razorpay Checkout modal
      const options = {
        key: subData.key_id,
        subscription_id: subData.subscription_id,
        name: 'Nagrek',
        description: currentPlan.name,
        image: '/images/food-pizza.webp',
        theme: { color: '#ff7e5f' },
        handler: function () {
          setStatusMessage('Payment authenticated! Unlocking queue…')
          setTimeout(onSuccess, 600)
        },
        modal: {
          ondismiss: function () {
            setLoading(false)
            setStatusMessage(null)
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', function (resp: any) {
        setError(resp.error?.description || 'Payment was declined')
        setLoading(false)
        setStatusMessage(null)
      })
      rzp.open()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setLoading(false)
      setStatusMessage(null)
    }
  }

  return (
    <motion.section
      aria-labelledby="paywall-title"
      className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-20 md:px-8"
      initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative w-full max-w-2xl">
        <div className="glass overflow-hidden rounded-3xl p-6 md:p-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
              <Sparkles className="size-3" /> Choose access
            </span>
            <h2 id="paywall-title" className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Never eat alone on <span className="font-serif italic text-sunset">nagrek</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Food matching with adults nearby — cancel in one tap anytime.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Plan Selector Grid */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const selected = selectedPlan === plan.id
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                    selected
                      ? 'border-accent/60 bg-primary/10 shadow-[0_0_0_1px_rgba(254,180,123,0.25)] scale-[1.01]'
                      : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute right-3 top-3 rounded-full bg-sunset px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      {plan.badge}
                    </span>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold tracking-tight">₹{plan.price}</span>
                      <span className="text-xs text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{plan.description}</p>
                  </div>

                  <ul className="mt-3 space-y-1 border-t border-white/10 pt-2.5 text-[11px] text-foreground/80">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <Check className="size-3 text-sunset shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>

          {/* Summary Box: Price, Renewal Date BEFORE Pay */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-muted-foreground">Selected Plan: </span>
                <strong className="text-foreground">{currentPlan.name}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Total due today: </span>
                <strong className="text-sunset text-sm">₹{currentPlan.price}</strong>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/10 pt-2.5 text-[11px] text-muted-foreground">
              <Clock className="size-3.5 text-sunset shrink-0" />
              <span>
                {currentPlan.price === 0 ? (
                  <>
                    7-day free trial ends on <strong className="text-foreground">{renewalDateString}</strong>. Renews at ₹149/mo unless cancelled.
                  </>
                ) : (
                  <>
                    Subscription period ends on <strong className="text-foreground">{renewalDateString}</strong> (auto-renews).
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Action CTA */}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sunset py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{statusMessage || 'Connecting to Razorpay…'}</span>
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  {currentPlan.price === 0 ? 'Start 7-Day Free Trial' : `Pay ₹${currentPlan.price} to Continue`}
                  <ChevronRight className="size-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              <span>Secured by Razorpay. 1-tap cancel anytime in settings.</span>
            </div>

            {onDemo && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onDemo}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Preview in demo mode instead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
