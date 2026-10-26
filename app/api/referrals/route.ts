import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServiceClient()
  if (!supabase) return NextResponse.json({ ok: true })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  let referrerId = String(body.referrer || '').trim()
  if (!referrerId || referrerId === authData.user.id) {
    return NextResponse.json({ ok: true })
  }

  if (!referrerId.includes('-')) {
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('id')
      .eq('username', referrerId)
      .maybeSingle()
    if (profile?.id) referrerId = profile.id
  }

  if (referrerId === authData.user.id) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await (supabase.from('referrals') as any).insert({
    referrer_id: referrerId,
    referred_id: authData.user.id,
  })

  if (error && error.code !== '23505') {
    console.warn('[nagrek] referral insert:', error.message)
  }

  return NextResponse.json({ ok: true })
}
