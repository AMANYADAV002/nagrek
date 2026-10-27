'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2, Phone, Search, UserPlus, Users, X } from 'lucide-react'
import { SOCIAL_LABELS, socialHref } from '@/lib/social-links'
import { MagneticButton } from './magnetic-button'

type FriendshipRow = {
  id: string
  status: 'pending' | 'accepted'
  other_user_id: string
  incoming?: boolean
  other: {
    username: string | null
    display_name: string | null
    avatar_url: string | null
    instagram?: string | null
    snapchat?: string | null
    facebook?: string | null
    linkedin?: string | null
  } | null
}

export function FriendsScreen({
  getAccessToken,
  onlineIds,
  onCallFriend,
  onClose,
}: {
  getAccessToken: () => Promise<string | null>
  onlineIds: Set<string>
  onCallFriend: (friendId: string) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState<FriendshipRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    { id: string; username: string | null; display_name: string | null }[]
  >([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setRows(data.friendships || [])
      }
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data.users || [])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, getAccessToken])

  const act = async (body: Record<string, string>, method: 'POST' | 'PATCH' = 'PATCH') => {
    const token = await getAccessToken()
    if (!token) return
    setBusy(body.id || body.receiver_id)
    try {
      await fetch('/api/friends', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      await load()
      setQuery('')
      setResults([])
    } finally {
      setBusy(null)
    }
  }

  const accepted = rows.filter((r) => r.status === 'accepted')
  const pending = rows.filter((r) => r.status === 'pending')

  return (
    <motion.section
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-labelledby="friends-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="glass max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 p-5 shadow-2xl md:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-accent" />
            <h2 id="friends-title" className="text-xl font-semibold tracking-tight">
              Friends
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        {results.length > 0 && (
          <ul className="mb-4 space-y-2">
            {results.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm"
              >
                <span>
                  @{u.username} {u.display_name ? `· ${u.display_name}` : ''}
                </span>
                <MagneticButton
                  size="md"
                  variant="glass"
                  disabled={busy === u.id}
                  onClick={() => act({ receiver_id: u.id }, 'POST')}
                >
                  <UserPlus className="size-4" />
                  Add
                </MagneticButton>
              </li>
            ))}
          </ul>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Pending</p>
                <ul className="space-y-2">
                  {pending.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm"
                    >
                      <span>@{r.other?.username || 'user'}</span>
                      <div className="flex gap-2">
                        {r.incoming ? (
                          <MagneticButton
                            size="md"
                            variant="success"
                            disabled={busy === r.id}
                            onClick={() => act({ id: r.id, action: 'accept' })}
                          >
                            <Check className="size-4" />
                          </MagneticButton>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sent</span>
                        )}
                        <MagneticButton
                          size="md"
                          variant="ghost"
                          disabled={busy === r.id}
                          onClick={() => act({ id: r.id, action: 'remove' })}
                        >
                          <X className="size-4" />
                        </MagneticButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Your friends</p>
            {accepted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No friends yet. After a great call, tap Add friend — then share Insta / Snap / FB / LinkedIn.
              </p>
            ) : (
              <ul className="space-y-3">
                {accepted.map((r) => {
                  const online = onlineIds.has(r.other_user_id)
                  const socials = SOCIAL_LABELS.filter((s) => r.other?.[s.key])
                  return (
                    <li key={r.id} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">@{r.other?.username || 'user'}</p>
                          <p className="text-xs text-muted-foreground">{online ? 'Online' : 'Offline'}</p>
                        </div>
                        <div className="flex gap-2">
                          <MagneticButton
                            size="md"
                            variant="primary"
                            disabled={!online}
                            onClick={() => onCallFriend(r.other_user_id)}
                          >
                            <Phone className="size-4" />
                            Call
                          </MagneticButton>
                          <MagneticButton
                            size="md"
                            variant="ghost"
                            onClick={() => act({ id: r.id, action: 'remove' })}
                          >
                            Remove
                          </MagneticButton>
                        </div>
                      </div>
                      {socials.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {socials.map((s) => {
                            const value = r.other?.[s.key]
                            if (!value) return null
                            return (
                              <a
                                key={s.key}
                                href={socialHref(s.key, value)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                              >
                                {s.label}: @{value.replace(/^@/, '')}
                              </a>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-muted-foreground">No social handles shared yet.</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </motion.div>
    </motion.section>
  )
}
