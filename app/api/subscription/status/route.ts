import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isSupabaseServerConfigured) {
      return NextResponse.json({
        subscribed: true,
        plan: 'trial',
        status: 'trial',
        current_period_end: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sub } = await (supabase.from('subscriptions') as any)
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!sub) {
      return NextResponse.json({
        subscribed: false,
        status: 'none',
      })
    }

    const isSubscribed =
      ['trial', 'active'].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date())

    return NextResponse.json({
      subscribed: isSubscribed,
      subscription: sub,
    })
  } catch (error: unknown) {
    console.error('[nagrek] /api/subscription/status error:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
