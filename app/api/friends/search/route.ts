import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { searchLocalUsers } from '@/lib/local-friends-store'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = String(req.nextUrl.searchParams.get('q') || '')
    .trim()
    .toLowerCase()
    .slice(0, 32)
  if (q.length < 2) return NextResponse.json({ users: [] })

  const supabase = getSupabaseServiceClient()
  if (supabase) {
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `${q}%`)
      .neq('id', authData.user.id)
      .limit(12)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data || [] })
  }

  const localId = req.headers.get('x-nagrek-local-user-id') || ''
  if (!/^local_[a-z0-9]{10,}$/.test(localId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ users: searchLocalUsers(q, localId) })
}
