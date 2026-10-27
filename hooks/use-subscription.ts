'use client'

import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/browser'

export type PlanKey = 'trial' | 'm1' | 'm3' | 'm6'

export interface SubscriptionData {
  user_id: string
  razorpay_subscription_id: string | null
  plan: PlanKey
  status: 'trial' | 'active' | 'halted' | 'cancelled' | 'expired'
  current_period_end: string | null
}

export function useSubscription(getAccessToken: () => string | null) {
  const [loading, setLoading] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)

  const checkStatus = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      setSubscribed(false)
      return
    }

    try {
      const res = await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSubscribed(Boolean(data.subscribed))
        setSubscription(data.subscription ?? null)
      } else {
        setSubscribed(false)
      }
    } catch {
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const subscribe = useCallback(
    async (plan: PlanKey) => {
      const token = getAccessToken()
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ plan }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to initiate subscription')
      }

      const data = await res.json()
      return data as {
        subscription_id: string
        plan: PlanKey
        test_mode: boolean
        key_id: string
      }
    },
    [getAccessToken],
  )

  const cancel = useCallback(async () => {
    const token = getAccessToken()
    const res = await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to cancel subscription')
    }
    const data = await res.json()
    await checkStatus()
    return data as { success: boolean; status: string; end_date: string | null }
  }, [getAccessToken, checkStatus])

  return {
    loading,
    subscribed,
    subscription,
    checkStatus,
    subscribe,
    cancel,
  }
}
