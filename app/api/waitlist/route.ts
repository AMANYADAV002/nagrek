import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ipBuckets = new Map<string, number[]>()
const MAX_PER_HOUR = 5

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000
  const stamps = (ipBuckets.get(ip) || []).filter((t) => now - t < windowMs)
  if (stamps.length >= MAX_PER_HOUR) return false
  stamps.push(now)
  ipBuckets.set(ip, stamps)
  return true
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: true })
  }

  let body: { email?: string; city?: string; source?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const city = body.city ? String(body.city).slice(0, 80) : null
  const source = body.source ? String(body.source).slice(0, 80) : 'landing'

  const supabase = getSupabaseServiceClient()
  if (!supabase) {
    console.warn('[nagrek] Waitlist insert skipped — Supabase service client not configured')
    return NextResponse.json({ ok: true })
  }

  const { error } = await (supabase.from('waitlist') as any).upsert(
    { email, city, source },
    { onConflict: 'email', ignoreDuplicates: true },
  )

  if (error && error.code !== '23505') {
    console.error('[nagrek] Waitlist error:', error.message)
  }

  return NextResponse.json({ ok: true })
}
