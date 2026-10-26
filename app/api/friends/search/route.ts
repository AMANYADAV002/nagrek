import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = String(req.nextUrl.searchParams.get('q') || '')
    .trim()
    .toLowerCase()
    .slice(0, 32)
  if (q.length < 2) return NextResponse.json({ users: [] })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', `${q}%`)
    .neq('id', authData.user.id)
    .limit(12)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data || [] })
}
