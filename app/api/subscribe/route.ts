import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

const PLAN_CONFIG: Record<
  string,
  { months: number; days: number; price: number; name: string }
> = {
  trial: { months: 0, days: 7, price: 0, name: '7-Day Free Trial' },
  m1: { months: 1, days: 30, price: 149, name: '1 Month Membership' },
  m3: { months: 3, days: 90, price: 399, name: '3 Months Membership' },
  m6: { months: 6, days: 180, price: 699, name: '6 Months Membership' },
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    let userId: string | null = null

    if (isSupabaseServerConfigured && token) {
      const supabase = getSupabaseServerClient()
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token)
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
      }
      userId = user.id
    } else {
      // In local dev without full Supabase keys, allow mock or query param
      const bodyPreview = await req.clone().json().catch(() => ({}))
      userId = bodyPreview.userId || 'dev-user-demo'
    }

    const { plan = 'trial' } = await req.json()
    const config = PLAN_CONFIG[plan]
    if (!config) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    let subscriptionId = `sub_test_${Math.random().toString(36).substring(2, 10)}`
    let testMode = true

    if (keyId && keySecret && !keyId.includes('placeholder')) {
      try {
        const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
        const planIdEnv =
          plan === 'm1'
            ? process.env.RAZORPAY_PLAN_MONTHLY
            : plan === 'm3'
              ? process.env.RAZORPAY_PLAN_QUARTERLY
              : plan === 'm6'
                ? process.env.RAZORPAY_PLAN_BIANNUAL
                : null

        if (planIdEnv) {
          const bodyPayload: Record<string, unknown> = {
            plan_id: planIdEnv,
            total_count: 12,
            quantity: 1,
            customer_notify: 1,
            notes: {
              user_id: userId,
              plan,
            },
          }
          if (plan === 'trial') {
            bodyPayload.start_at = Math.floor(Date.now() / 1000) + 7 * 86400
          }

          const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyPayload),
          })

          if (res.ok) {
            const rzData = await res.json()
            subscriptionId = rzData.id
            testMode = false
          }
        }
      } catch (err) {
        console.warn('[nagrek] Razorpay API call failed, falling back to test subscription id', err)
      }
    }

    // In test mode or when testing without external webhooks, record in DB with service role
    if (isSupabaseServerConfigured && userId) {
      const supabase = getSupabaseServerClient()
      const periodEnd = new Date(Date.now() + config.days * 86400000).toISOString()
      await (supabase.from('subscriptions') as any).upsert({
        user_id: userId,
        razorpay_subscription_id: subscriptionId,
        plan,
        status: plan === 'trial' ? 'trial' : 'active',
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      subscription_id: subscriptionId,
      plan,
      test_mode: testMode,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId || 'rzp_test_placeholder',
    })
  } catch (error: unknown) {
    console.error('[nagrek] /api/subscribe error:', error)
    return NextResponse.json({ error: 'Failed to process subscription request' }, { status: 500 })
  }
}
