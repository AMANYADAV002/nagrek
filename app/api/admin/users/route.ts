import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/supabase/admin-guard'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { isAdmin, errorResponse } = await verifyAdmin(req)
  if (!isAdmin) return errorResponse!

  if (!isSupabaseServerConfigured) {
    return NextResponse.json({
      users: [
        {
          id: 'dev-admin-id',
          username: 'admin',
          display_name: 'Super Admin',
          role: 'admin',
          age_confirmed_at: new Date().toISOString(),
          banned_at: null,
          ban_reason: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'user-demo-1',
          username: 'ramen_fan',
          display_name: 'Ramen Lover',
          role: 'user',
          age_confirmed_at: new Date().toISOString(),
          banned_at: null,
          ban_reason: null,
          created_at: new Date().toISOString(),
        },
      ],
    })
  }

  try {
    const supabase = getSupabaseServerClient()
    const { data: users, error } = await (supabase.from('profiles') as any)
      .select('id, username, display_name, role, age_confirmed_at, banned_at, ban_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[nagrek] Fetch users error:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json({ users: users || [] })
  } catch (error) {
    console.error('[nagrek] /api/admin/users GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
