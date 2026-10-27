/**
 * In-memory friends graph for local/dev when Supabase is unset.
 * Shared by API routes via globalThis so Hot Reload keeps state in one process.
 */

export type LocalFriendProfile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  instagram: string | null
  snapchat: string | null
  facebook: string | null
  linkedin: string | null
}

type Pending = { id: string; requester_id: string; receiver_id: string; created_at: string }

type Store = {
  profiles: Map<string, LocalFriendProfile>
  pending: Map<string, Pending>
  accepted: Map<string, Set<string>> // userId -> friend ids
}

function store(): Store {
  const g = globalThis as unknown as { __nagrekLocalFriends?: Store }
  if (!g.__nagrekLocalFriends) {
    g.__nagrekLocalFriends = {
      profiles: new Map(),
      pending: new Map(),
      accepted: new Map(),
    }
  }
  return g.__nagrekLocalFriends
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join('::')
}

export function upsertLocalProfile(profile: LocalFriendProfile) {
  store().profiles.set(profile.id, { ...profile })
}

export function getLocalProfile(id: string) {
  return store().profiles.get(id) || null
}

export function listLocalFriendships(userId: string) {
  const s = store()
  const rows: Array<{
    id: string
    status: 'pending' | 'accepted'
    other_user_id: string
    incoming?: boolean
    other: LocalFriendProfile | null
  }> = []

  for (const p of s.pending.values()) {
    if (p.requester_id !== userId && p.receiver_id !== userId) continue
    const otherId = p.requester_id === userId ? p.receiver_id : p.requester_id
    rows.push({
      id: p.id,
      status: 'pending',
      other_user_id: otherId,
      incoming: p.receiver_id === userId,
      other: s.profiles.get(otherId) || null,
    })
  }

  const friends = s.accepted.get(userId)
  if (friends) {
    for (const otherId of friends) {
      rows.push({
        id: `accepted_${pairKey(userId, otherId)}`,
        status: 'accepted',
        other_user_id: otherId,
        other: s.profiles.get(otherId) || null,
      })
    }
  }

  return rows
}

export function searchLocalUsers(q: string, selfId: string) {
  const needle = q.toLowerCase()
  return [...store().profiles.values()]
    .filter((p) => p.id !== selfId && (p.username.includes(needle) || p.display_name.toLowerCase().includes(needle)))
    .slice(0, 20)
    .map(({ id, username, display_name }) => ({ id, username, display_name }))
}

export function requestLocalFriend(requesterId: string, receiverId: string) {
  if (!requesterId || !receiverId || requesterId === receiverId) return { error: 'Invalid receiver', status: 400 }
  const s = store()
  if (s.accepted.get(requesterId)?.has(receiverId)) return { error: 'Already friends', status: 409 }
  const key = pairKey(requesterId, receiverId)
  for (const p of s.pending.values()) {
    if (pairKey(p.requester_id, p.receiver_id) === key) return { error: 'Friend request already exists', status: 409 }
  }
  const id = `pending_${key}_${Date.now()}`
  s.pending.set(id, {
    id,
    requester_id: requesterId,
    receiver_id: receiverId,
    created_at: new Date().toISOString(),
  })
  return { friendship: { id, status: 'pending' as const } }
}

export function acceptLocalFriend(userId: string, friendshipId: string) {
  const s = store()
  const p = s.pending.get(friendshipId)
  if (!p || p.receiver_id !== userId) return { error: 'Not found', status: 404 }
  s.pending.delete(friendshipId)
  if (!s.accepted.has(p.requester_id)) s.accepted.set(p.requester_id, new Set())
  if (!s.accepted.has(p.receiver_id)) s.accepted.set(p.receiver_id, new Set())
  s.accepted.get(p.requester_id)!.add(p.receiver_id)
  s.accepted.get(p.receiver_id)!.add(p.requester_id)
  return { friendship: { id: friendshipId, status: 'accepted' as const } }
}

export function removeLocalFriend(userId: string, friendshipId: string) {
  const s = store()
  if (friendshipId.startsWith('pending_')) {
    const p = s.pending.get(friendshipId)
    if (p && (p.requester_id === userId || p.receiver_id === userId)) s.pending.delete(friendshipId)
    return { ok: true }
  }
  if (friendshipId.startsWith('accepted_')) {
    const key = friendshipId.replace(/^accepted_/, '')
    const [a, b] = key.split('::')
    if (userId !== a && userId !== b) return { error: 'Forbidden', status: 403 }
    s.accepted.get(a)?.delete(b)
    s.accepted.get(b)?.delete(a)
    return { ok: true }
  }
  return { error: 'Not found', status: 404 }
}

export function areLocalFriends(a: string, b: string) {
  return Boolean(store().accepted.get(a)?.has(b))
}
