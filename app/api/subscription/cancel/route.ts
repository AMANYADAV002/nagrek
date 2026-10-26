import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 })
    }

    if (!isSupabaseServerConfigured) {
      return NextResponse.json({
        success: true,
        status: 'cancelled',
        end_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
    }

    const { data: sub, error: subError } = await (supabase.from('subscriptions') as any)
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError || !sub) {
      return NextResponse.json({ error: 'No active subscription found to cancel' }, { status: 404 })
    }

    let endDate = sub.current_period_end

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (keyId && keySecret && sub.razorpay_subscription_id && !sub.razorpay_subscription_id.startsWith('sub_test_')) {
      try {
        const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
        const rzRes = await fetch(
          `https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cancel_at_cycle_end: 1 }),
          },
        )
        if (rzRes.ok) {
          const rzData = await rzRes.json()
          if (rzData.current_end) {
            endDate = new Date(rzData.current_end * 1000).toISOString()
          }
        }
      } catch (err) {
        console.warn('[nagrek] Razorpay cancel call failed:', err)
      }
    }

    // Update status in database to cancelled
    await (supabase.from('subscriptions') as any)
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      status: 'cancelled',
      end_date: endDate,
    })
  } catch (error: unknown) {
    console.error('[nagrek] /api/subscription/cancel error:', error)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
