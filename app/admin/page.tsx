'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface Report {
  id: string
  reporter_id: string
  reported_id: string | null
  match_id: string | null
  reason: string
  status: 'open' | 'reviewed' | 'actioned'
  created_at: string
}

interface Profile {
  id: string
  username: string | null
  display_name: string | null
  role: 'user' | 'admin'
  age_confirmed_at: string | null
  banned_at: string | null
  ban_reason: string | null
  created_at: string
}

export default function AdminPage() {
  const { user, profile, loading: authLoading, getAccessToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports')
  const [reports, setReports] = useState<Report[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'reviewed' | 'actioned'>('open')
  const [searchQuery, setSearchQuery] = useState('')

  // Ban modal state
  const [banModalUser, setBanModalUser] = useState<Profile | null>(null)
  const [banReasonInput, setBanReasonInput] = useState('')
  const [actioningBan, setActioningBan] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const fetchReports = async () => {
    try {
      setLoadingReports(true)
      const token = await getAccessToken()
      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (err) {
      console.error('Failed to fetch reports', err)
    } finally {
      setLoadingReports(false)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const token = await getAccessToken()
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error('Failed to fetch users', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchReports()
      fetchUsers()
    }
  }, [isAdmin])

  const handleUpdateReportStatus = async (reportId: string, status: 'reviewed' | 'actioned') => {
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportId, status }),
      })
      if (res.ok) {
        setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)))
      }
    } catch (err) {
      console.error('Failed to update report status', err)
    }
  }

  const handleBanSubmit = async () => {
    if (!banModalUser) return
    try {
      setActioningBan(true)
      const token = await getAccessToken()
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: banModalUser.id,
          banned: true,
          reason: banReasonInput.trim() || 'Violation of Nagrek Community Guidelines',
        }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === banModalUser.id
              ? { ...u, banned_at: new Date().toISOString(), ban_reason: banReasonInput.trim() }
              : u,
          ),
        )
        setBanModalUser(null)
        setBanReasonInput('')
      }
    } catch (err) {
      console.error('Failed to ban user', err)
    } finally {
      setActioningBan(false)
    }
  }

  const handleUnban = async (userId: string) => {
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          banned: false,
        }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, banned_at: null, ban_reason: null } : u)),
        )
      }
    } catch (err) {
      console.error('Failed to unban user', err)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <Loader2 className="size-8 animate-spin text-sunset" />
      </div>
    )
  }

  // Acceptance Criteria: Non-admin gets 403 Forbidden
  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <div className="relative mx-auto flex size-20 items-center justify-center rounded-3xl border border-destructive/20 bg-destructive/10 text-destructive shadow-2xl">
          <Lock className="size-10" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">403 Forbidden</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Access Denied. You do not have administrator permissions to access the Nagrek safety and moderation console.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          Return to Nagrek
        </a>
      </main>
    )
  }

  const filteredReports = reports.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    return true
  })

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.username?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  })

  const openReportsCount = reports.filter((r) => r.status === 'open').length

  return (
    <div className="ambient-bg min-h-dvh px-4 py-8 text-foreground md:px-12">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-8">
        <div>
          <div className="flex items-center gap-2 text-sunset font-semibold text-sm tracking-wide uppercase">
            <Shield className="size-4" /> Admin Moderation Console
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl mt-1">Nagrek Trust & Safety</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logged in as <span className="font-semibold text-white">{profile?.username || user.email}</span> (Role: Admin)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            Go to App
          </a>
          <button
            onClick={() => {
              fetchReports()
              fetchUsers()
            }}
            className="flex items-center gap-1.5 rounded-full bg-sunset px-4 py-2 text-xs font-semibold text-white shadow-lg hover:brightness-110"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl mt-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'reports'
                ? 'border-sunset text-white'
                : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            <ShieldAlert className="size-4" />
            Reports Queue
            {openReportsCount > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
                {openReportsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'users'
                ? 'border-sunset text-white'
                : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            <UserCheck className="size-4" />
            Users Directory ({users.length})
          </button>
        </div>

        {/* Tab 1: Reports Queue */}
        {activeTab === 'reports' && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {(['open', 'reviewed', 'actioned', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                      statusFilter === filter
                        ? 'bg-white/15 text-white shadow'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Showing {filteredReports.length} reports</span>
            </div>

            {loadingReports ? (
              <div className="flex py-16 justify-center">
                <Loader2 className="size-6 animate-spin text-sunset" />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 py-16 text-center">
                <CheckCircle className="mx-auto size-10 text-emerald-400" />
                <h3 className="mt-3 text-sm font-semibold">Queue is Clear</h3>
                <p className="mt-1 text-xs text-muted-foreground">No reports matching the selected filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            report.status === 'open'
                              ? 'bg-destructive/20 text-destructive'
                              : report.status === 'actioned'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {report.status}
                        </span>
                        <span className="text-xs font-semibold text-white">{report.reason}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Reported User: <code className="text-white">{report.reported_id || 'Unknown / Demo'}</code></span>
                        <span>Reporter: <code className="text-white">{report.reporter_id}</code></span>
                        <span>Match: <code className="text-white">{report.match_id || 'N/A'}</code></span>
                        <span>{new Date(report.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {report.status === 'open' && (
                        <button
                          onClick={() => handleUpdateReportStatus(report.id, 'reviewed')}
                          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                        >
                          <Check className="size-3.5 text-emerald-400" /> Mark Reviewed
                        </button>
                      )}
                      {report.reported_id && (
                        <button
                          onClick={() => {
                            setBanModalUser({
                              id: report.reported_id!,
                              username: null,
                              display_name: null,
                              role: 'user',
                              age_confirmed_at: null,
                              banned_at: null,
                              ban_reason: null,
                              created_at: '',
                            })
                            setBanReasonInput(`Reported for: ${report.reason}`)
                          }}
                          className="flex items-center gap-1 rounded-xl bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90"
                        >
                          <Ban className="size-3.5" /> Action & Ban
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Users Directory */}
        {activeTab === 'users' && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by username, display name, or UUID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-xs text-white placeholder:text-muted-foreground focus:border-sunset focus:outline-none"
                />
              </div>
              <span className="text-xs text-muted-foreground">Showing {filteredUsers.length} users</span>
            </div>

            {loadingUsers ? (
              <div className="flex py-16 justify-center">
                <Loader2 className="size-6 animate-spin text-sunset" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 py-16 text-center">
                <h3 className="text-sm font-semibold">No Users Found</h3>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">
                          {u.display_name || u.username || 'Anonymous'}
                        </span>
                        {u.username && <span className="text-xs text-muted-foreground">@{u.username}</span>}
                        {u.role === 'admin' && (
                          <span className="rounded-full bg-sunset/20 px-2 py-0.5 text-[10px] font-bold text-sunset">
                            ADMIN
                          </span>
                        )}
                        {u.banned_at && (
                          <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">
                            BANNED
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>ID: <code className="text-white">{u.id}</code></span>
                        <span>18+ Verified: {u.age_confirmed_at ? 'Yes' : 'No'}</span>
                        {u.banned_at && (
                          <span className="text-destructive font-medium">
                            Ban Reason: {u.ban_reason || 'Community violation'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {u.role !== 'admin' && (
                        <>
                          {u.banned_at ? (
                            <button
                              onClick={() => handleUnban(u.id)}
                              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
                            >
                              <UserCheck className="size-3.5" /> Unban
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setBanModalUser(u)
                                setBanReasonInput('')
                              }}
                              className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
                            >
                              <UserX className="size-3.5" /> Ban
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Ban User Modal */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setBanModalUser(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Ban User Account</h3>
                <p className="text-xs text-muted-foreground">
                  User will be disconnected and barred from socket access.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Target User: <code className="text-white">{banModalUser.id}</code>
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reason for Ban (visible to user on login rejection)
                </label>
                <textarea
                  rows={3}
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="e.g. Inappropriate behavior during video call"
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder:text-muted-foreground focus:border-destructive focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBanModalUser(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actioningBan}
                onClick={handleBanSubmit}
                className="flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-destructive/90"
              >
                {actioningBan && <Loader2 className="size-3.5 animate-spin" />}
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
