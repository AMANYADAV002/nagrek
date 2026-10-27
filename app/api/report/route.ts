import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

// In-memory sliding rate limit fallback for report (5 / hour)
const memoryRateLimits = new Map<string, number[]>()

function checkMemoryRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowMs = 3600_000 // 1 hour
  const limit = 5
  const timestamps = (memoryRateLimits.get(userId) || []).filter((t) => now - t < windowMs)
  if (timestamps.length >= limit) return false
  timestamps.push(now)
  memoryRateLimits.set(userId, timestamps)
  return true
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let reporterId: string

    if (!isSupabaseServerConfigured) {
      reporterId = 'guest-reporter'
      if (!checkMemoryRateLimit(reporterId)) {
        return NextResponse.json({ error: 'Rate limit exceeded: 5 reports per hour.' }, { status: 429 })
      }
      return NextResponse.json({ success: true, message: 'Report submitted (demo mode).' })
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    reporterId = user.id

    // Check rate limit: count reports in the last hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
    const { count, error: countErr } = await (supabase.from('reports') as any)
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', reporterId)
      .gte('created_at', oneHourAgo)

    if (!countErr && typeof count === 'number' && count >= 5) {
      return NextResponse.json({ error: 'Rate limit exceeded: 5 reports per hour.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { reported_id, match_id, reason } = body

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'A valid reason is required.' }, { status: 400 })
    }

    const { data: inserted, error: insertError } = await (supabase.from('reports') as any)
      .insert({
        reporter_id: reporterId,
        reported_id: reported_id || null,
        match_id: match_id || null,
        reason: reason.trim(),
        status: 'open',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[nagrek] Report insert error:', insertError)
      return NextResponse.json({ error: 'Failed to record report' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      id: inserted?.id,
      message: 'Report submitted. Our moderation team has been notified.',
    })
  } catch (error: unknown) {
    console.error('[nagrek] /api/report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
