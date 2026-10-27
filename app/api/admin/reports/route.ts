import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/supabase/admin-guard'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { isAdmin, errorResponse } = await verifyAdmin(req)
  if (!isAdmin) return errorResponse!

  if (!isSupabaseServerConfigured) {
    return NextResponse.json({
      reports: [
        {
          id: 'demo-report-1',
          reporter_id: 'user-1',
          reported_id: 'user-2',
          match_id: 'room_123',
          reason: 'Inappropriate behavior / Nudity',
          status: 'open',
          created_at: new Date().toISOString(),
          reporter_name: 'alice',
          reported_name: 'bad_actor',
        },
      ],
    })
  }

  try {
    const supabase = getSupabaseServerClient()
    const { data: reports, error } = await (supabase.from('reports') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[nagrek] Fetch reports error:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    return NextResponse.json({ reports: reports || [] })
  } catch (error) {
    console.error('[nagrek] /api/admin/reports GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { isAdmin, errorResponse } = await verifyAdmin(req)
  if (!isAdmin) return errorResponse!

  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ success: true, message: 'Status updated (demo mode)' })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { reportId, status } = body

    if (!reportId || !['open', 'reviewed', 'actioned'].includes(status)) {
      return NextResponse.json({ error: 'Valid reportId and status (open|reviewed|actioned) required' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    const { error } = await (supabase.from('reports') as any)
      .update({ status })
      .eq('id', reportId)

    if (error) {
      console.error('[nagrek] Update report error:', error)
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error('[nagrek] /api/admin/reports PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
