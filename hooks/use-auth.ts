'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/browser'

export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  age_confirmed_at: string | null
  location_cell: string | null
  location_updated_at: string | null
  instagram: string | null
  snapchat: string | null
  facebook: string | null
  linkedin: string | null
  role: 'user' | 'admin'
  banned_at: string | null
  ban_reason: string | null
  created_at: string
  updated_at: string
}

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data as Profile | null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    const supabase = getSupabaseBrowserClient()

    // Grab whatever session already exists (localStorage / URL tokens)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        fetchProfile(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        fetchProfile(newSession.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  /* ---- actions ---- */

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      signInAsGuest()
      return
    }
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' },
    })
  }, [])

  const signInWithEmail = useCallback(async (email: string): Promise<{ error: Error | null }> => {
    if (!isSupabaseConfigured) {
      signInAsGuest()
      return { error: null }
    }
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : '' },
    })
    return { error }
  }, [])

  const signInAsGuest = useCallback(() => {
    const guestUser = {
      id: 'dev-guest-user',
      email: 'guest@nagrek.local',
      user_metadata: { full_name: 'Foodie Explorer', name: 'Foodie Explorer' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User

    setUser(guestUser)
    setSession({ access_token: 'dev-guest-token' } as unknown as Session)
    setProfile({
      id: 'dev-guest-user',
      username: 'foodie',
      display_name: 'Foodie Explorer',
      avatar_url: null,
      age_confirmed_at: new Date().toISOString(),
      location_cell: null,
      location_updated_at: null,
      instagram: null,
      snapchat: null,
      facebook: null,
      linkedin: null,
      role: 'user',
      banned_at: null,
      ban_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setLoading(false)
  }, [])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.signOut()
    }
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (updates: Partial<Omit<Profile, 'id' | 'created_at'>>) => {
      if (!user) return { error: new Error('Not signed in') }
      if (!isSupabaseConfigured) {
        setProfile((prev) => (prev ? { ...prev, ...updates } : null))
        return { error: null }
      }
      const supabase = getSupabaseBrowserClient()
      const { error } = await (supabase.from('profiles') as any).upsert({
        id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      if (!error) await fetchProfile(user.id)
      return { error: (error as Error | null) }
    },
    [user, fetchProfile],
  )

  const refreshProfile = useCallback(() => {
    if (user && isSupabaseConfigured) fetchProfile(user.id)
  }, [user, fetchProfile])

  /** True when user exists but hasn't completed onboarding username or 18+ check. */
  const needsProfile = Boolean(user && (!profile?.username || !profile?.age_confirmed_at))

  const getAccessToken = useCallback(async () => {
    if (session?.access_token) return session.access_token
    if (!isSupabaseConfigured) return null
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [session?.access_token])

  return {
    loading,
    user,
    session,
    profile,
    needsProfile,
    isConfigured: isSupabaseConfigured,
    getAccessToken,
    signInWithGoogle,
    signInWithEmail,
    signInAsGuest,
    signOut,
    updateProfile,
    refreshProfile,
  }
}

export type Auth = ReturnType<typeof useAuth>
