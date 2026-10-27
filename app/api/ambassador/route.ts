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

  let body: { name?: string; email?: string; campus?: string; city?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = String(body.name || '').trim().slice(0, 80)
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const campus = String(body.campus || '').trim().slice(0, 120)
  const city = body.city ? String(body.city).trim().slice(0, 80) : null
  const note = body.note ? String(body.note).trim().slice(0, 500) : null

  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (!campus || campus.length < 2) {
    return NextResponse.json({ error: 'Campus required' }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  if (!supabase) {
    console.warn('[nagrek] Ambassador insert skipped — Supabase service client not configured')
    return NextResponse.json({ ok: true })
  }

  const { error } = await (supabase.from('ambassadors') as any).upsert(
    { name, email, campus, city, note },
    { onConflict: 'email', ignoreDuplicates: false },
  )

  if (error && error.code !== '23505') {
    console.error('[nagrek] Ambassador error:', error.message)
  }

  return NextResponse.json({ ok: true })
}
