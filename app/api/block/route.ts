import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ success: true, message: 'User blocked (demo mode).' })
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { blocked_id } = body

    if (!blocked_id || typeof blocked_id !== 'string') {
      return NextResponse.json({ error: 'Valid blocked_id is required.' }, { status: 400 })
    }

    if (blocked_id === user.id) {
      return NextResponse.json({ error: 'Cannot block yourself.' }, { status: 400 })
    }

    const { error: blockError } = await (supabase.from('blocks') as any)
      .upsert({
        blocker_id: user.id,
        blocked_id,
      }, { onConflict: 'blocker_id,blocked_id' })

    if (blockError) {
      console.error('[nagrek] Block insert error:', blockError)
      return NextResponse.json({ error: 'Failed to record block' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'User blocked successfully. You will never be matched with this user again.',
    })
  } catch (error: unknown) {
    console.error('[nagrek] /api/block error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ blocks: [] })
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: blocks, error } = await (supabase.from('blocks') as any)
      .select('blocked_id, created_at')
      .eq('blocker_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 })
    }

    return NextResponse.json({ blocks: blocks || [] })
  } catch (error: unknown) {
    console.error('[nagrek] GET /api/block error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
