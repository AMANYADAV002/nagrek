import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

const ALLOWED = new Set([
  'landing_view',
  'start_click',
  'waitlist_join',
  'signup',
  'onboarding_done',
  'paywall_view',
  'trial_start',
  'queue_join',
  'match_found',
  'both_accepted',
  'call_over_2min',
  'friend_added',
  'paid',
  'report_sent',
  'meal_window_view',
  'meal_window_notify_on',
  'meal_window_notify_fired',
  'referral_click',
  'rating_submitted',
  'ambassador_apply',
])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || '')
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  }

  const props = body.props && typeof body.props === 'object' ? body.props : {}
  const safeProps = { ...props }
  delete safeProps.email
  delete safeProps.phone
  delete safeProps.coords
  delete safeProps.lat
  delete safeProps.lon

  let userId: string | null = null
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const supabase = getSupabaseServiceClient()

  if (supabase && token) {
    const { data } = await supabase.auth.getUser(token)
    userId = data.user?.id ?? null
  }

  if (supabase) {
    const { error } = await (supabase.from('events') as any).insert({
      user_id: userId,
      name,
      props: safeProps,
    })
    if (error) console.warn('[nagrek] event insert:', error.message)
  }

  return NextResponse.json({ ok: true })
}
