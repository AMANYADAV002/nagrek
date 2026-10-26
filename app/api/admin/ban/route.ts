import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/supabase/admin-guard'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { isAdmin, errorResponse } = await verifyAdmin(req)
  if (!isAdmin) return errorResponse!

  try {
    const body = await req.json().catch(() => ({}))
    const { userId, banned, reason } = body

    if (!userId || typeof banned !== 'boolean') {
      return NextResponse.json({ error: 'userId and boolean banned flag are required' }, { status: 400 })
    }

    if (!isSupabaseServerConfigured) {
      return NextResponse.json({
        success: true,
        message: banned ? `User ${userId} banned (demo mode)` : `User ${userId} unbanned (demo mode)`,
      })
    }

    const supabase = getSupabaseServerClient()

    const updatePayload = banned
      ? {
          banned_at: new Date().toISOString(),
          ban_reason: (reason || 'Violation of Community Guidelines').trim(),
        }
      : {
          banned_at: null,
          ban_reason: null,
        }

    const { error } = await (supabase.from('profiles') as any)
      .update(updatePayload)
      .eq('id', userId)

    if (error) {
      console.error('[nagrek] Ban user error:', error)
      return NextResponse.json({ error: 'Failed to update ban status' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      banned,
      userId,
      reason: banned ? updatePayload.ban_reason : null,
    })
  } catch (error) {
    console.error('[nagrek] /api/admin/ban POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
