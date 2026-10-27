import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (!secret || !signature) {
      console.warn('[nagrek webhook] Missing signature or webhook secret')
      return NextResponse.json({ error: 'Invalid signature or secret' }, { status: 400 })
    }

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)

    const isValid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer)

    if (!isValid) {
      console.warn('[nagrek webhook] Bad signature received')
      return NextResponse.json({ error: 'Bad signature' }, { status: 400 })
    }

    const payload = JSON.parse(rawBody)
    const eventType = payload.event
    const eventId =
      req.headers.get('x-razorpay-event-id') ||
      payload.id ||
      payload.event_id ||
      `${eventType}_${payload.payload?.subscription?.entity?.id || 'sub'}_${payload.created_at || Date.now()}`

    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ received: true, dev_mode: true })
    }

    const supabase = getSupabaseServerClient()

    // 1. Idempotency: skip if event_id already exists in payment_events
    const { data: existingEvent } = await (supabase.from('payment_events') as any)
      .select('event_id')
      .eq('event_id', eventId)
      .single()

    if (existingEvent) {
      console.log(`[nagrek webhook] Replayed event ignored: ${eventId}`)
      return NextResponse.json({ received: true, ignored: true })
    }

    // 2. Insert into payment_events
    await (supabase.from('payment_events') as any).insert({
      event_id: eventId,
      type: eventType,
      payload: payload as any,
      received_at: new Date().toISOString(),
    })

    // 3. Update subscription status in DB
    const subEntity = payload.payload?.subscription?.entity
    if (subEntity) {
      const subId = subEntity.id
      const userId = subEntity.notes?.user_id
      const currentEnd = subEntity.current_end
        ? new Date(subEntity.current_end * 1000).toISOString()
        : null

      let newStatus: 'trial' | 'active' | 'halted' | 'cancelled' | 'expired' | null = null

      switch (eventType) {
        case 'subscription.authenticated':
          newStatus = subEntity.status === 'authenticated' ? 'trial' : 'active'
          break
        case 'subscription.activated':
          newStatus = 'active'
          break
        case 'subscription.charged':
          newStatus = 'active'
          break
        case 'subscription.halted':
          newStatus = 'halted'
          break
        case 'subscription.cancelled':
          newStatus = 'cancelled'
          break
        case 'subscription.completed':
          newStatus = 'expired'
          break
        default:
          break
      }

      if (newStatus) {
        const updateData: {
          status: 'trial' | 'active' | 'halted' | 'cancelled' | 'expired'
          current_period_end?: string | null
          updated_at: string
        } = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        }
        if (currentEnd) updateData.current_period_end = currentEnd

        if (userId) {
          await (supabase.from('subscriptions') as any)
            .update(updateData)
            .eq('user_id', userId)
        } else if (subId) {
          await (supabase.from('subscriptions') as any)
            .update(updateData)
            .eq('razorpay_subscription_id', subId)
        }
        console.log(`[nagrek webhook] Subscription updated: id=${subId} status=${newStatus}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error('[nagrek webhook] Internal error:', error)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }
}
