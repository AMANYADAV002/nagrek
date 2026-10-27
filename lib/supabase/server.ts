import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey)

let serverClient: SupabaseClient<Database> | null = null

/**
 * Server-only Supabase client with the service role key.
 * Used for admin tasks, webhook processing, and verifying JWTs in Node.
 * NEVER expose this to the browser bundle.
 */
export function getSupabaseServerClient(): SupabaseClient<Database> {
  if (!serverClient) {
    if (!isSupabaseServerConfigured) {
      throw new Error('[nagrek] Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL on server')
    }
    serverClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return serverClient
}

/** Same as getSupabaseServerClient but returns null when env is missing. */
export function getSupabaseServiceClient(): SupabaseClient<Database> | null {
  if (!isSupabaseServerConfigured) return null
  try {
    return getSupabaseServerClient()
  } catch {
    return null
  }
}
