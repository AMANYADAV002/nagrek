/** Stable local guest identity when Supabase is not configured. */

const KEY = 'nagrek_local_user_id'
const PROFILE_KEY = 'nagrek_local_profile'

export function getOrCreateLocalUserId(): string {
  if (typeof window === 'undefined') return 'local_server'
  try {
    let id = localStorage.getItem(KEY)
    if (!id || !/^local_[a-z0-9]{10,}$/.test(id)) {
      id = `local_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return `local_${Date.now().toString(36)}`
  }
}

export type LocalProfile = {
  username: string
  display_name: string
  avatar_url: string | null
  instagram: string | null
  snapchat: string | null
  facebook: string | null
  linkedin: string | null
}

export function readLocalProfile(): LocalProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as LocalProfile) : null
  } catch {
    return null
  }
}

export function writeLocalProfile(profile: LocalProfile) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    /* ignore */
  }
}
