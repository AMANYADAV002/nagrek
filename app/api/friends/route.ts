import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import {
  acceptLocalFriend,
  listLocalFriendships,
  removeLocalFriend,
  requestLocalFriend,
  upsertLocalProfile,
} from '@/lib/local-friends-store'

function localUserId(req: NextRequest): string | null {
  const id = req.headers.get('x-nagrek-local-user-id') || ''
  return /^local_[a-z0-9]{10,}$/.test(id) ? id : null
}

async function userFromAuth(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const supabase = getSupabaseServiceClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { supabase, user: data.user }
}

export async function GET(req: NextRequest) {
  const ctx = await userFromAuth(req)
  if (ctx) {
    const { supabase, user } = ctx
    const { data: rows, error } = await (supabase.from('friendships') as any)
      .select('id, requester_id, receiver_id, status, created_at')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const friendIds = new Set<string>()
    for (const row of rows || []) {
      friendIds.add(row.requester_id === user.id ? row.receiver_id : row.requester_id)
    }

    const profiles: Record<string, any> = {}
    if (friendIds.size) {
      const { data: profileRows } = await (supabase.from('profiles') as any)
        .select('id, username, display_name, avatar_url, instagram, snapchat, facebook, linkedin')
        .in('id', [...friendIds])
      for (const p of profileRows || []) {
        profiles[p.id] = {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          instagram: p.instagram ?? null,
          snapchat: p.snapchat ?? null,
          facebook: p.facebook ?? null,
          linkedin: p.linkedin ?? null,
        }
      }
    }

    return NextResponse.json({
      mode: 'supabase',
      friendships: (rows || []).map((r: any) => {
        const otherId = r.requester_id === user.id ? r.receiver_id : r.requester_id
        return {
          ...r,
          other_user_id: otherId,
          other: profiles[otherId] || null,
          incoming: r.receiver_id === user.id && r.status === 'pending',
        }
      }),
    })
  }

  const localId = localUserId(req)
  if (!localId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Register/update profile snapshot from client for search + social display
  const username = req.headers.get('x-nagrek-username') || `user_${localId.slice(-4)}`
  const display = req.headers.get('x-nagrek-display') || username
  upsertLocalProfile({
    id: localId,
    username: username.slice(0, 24),
    display_name: display.slice(0, 40),
    avatar_url: null,
    instagram: req.headers.get('x-nagrek-instagram') || null,
    snapchat: req.headers.get('x-nagrek-snapchat') || null,
    facebook: req.headers.get('x-nagrek-facebook') || null,
    linkedin: req.headers.get('x-nagrek-linkedin') || null,
  })

  return NextResponse.json({ mode: 'local', friendships: listLocalFriendships(localId) })
}

export async function POST(req: NextRequest) {
  const ctx = await userFromAuth(req)
  const body = await req.json().catch(() => ({}))
  const receiverId = String(body.receiver_id || '')

  if (ctx) {
    const { supabase, user } = ctx
    if (!receiverId || receiverId === user.id) {
      return NextResponse.json({ error: 'Invalid receiver' }, { status: 400 })
    }

    const { data: blocked } = await (supabase.from('blocks') as any)
      .select('blocker_id')
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${user.id})`,
      )
      .limit(1)

    if (blocked && blocked.length) {
      return NextResponse.json({ error: 'Cannot friend a blocked user' }, { status: 403 })
    }

    const { data, error } = await (supabase.from('friendships') as any)
      .insert({ requester_id: user.id, receiver_id: receiverId, status: 'pending' })
      .select('id, status')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Friend request already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ friendship: data })
  }

  const localId = localUserId(req)
  if (!localId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = requestLocalFriend(localId, receiverId)
  if ('error' in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 })
  }
  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const ctx = await userFromAuth(req)
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  const action = String(body.action || '')
  if (!id || !['accept', 'remove'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (ctx) {
    const { supabase, user } = ctx
    if (action === 'accept') {
      const { data, error } = await (supabase.from('friendships') as any)
        .update({ status: 'accepted' })
        .eq('id', id)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .select('id, status')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ friendship: data })
    }

    const { error } = await (supabase.from('friendships') as any)
      .delete()
      .eq('id', id)
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const localId = localUserId(req)
  if (!localId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = action === 'accept' ? acceptLocalFriend(localId, id) : removeLocalFriend(localId, id)
  if ('error' in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 })
  }
  return NextResponse.json(result)
}
