import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export interface AdminAuthResult {
  isAdmin: boolean
  userId: string | null
  errorResponse?: NextResponse
}

export async function verifyAdmin(req: NextRequest): Promise<AdminAuthResult> {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    return {
      isAdmin: false,
      userId: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 }),
    }
  }

  if (!isSupabaseServerConfigured) {
    // In demo/local development without Supabase keys, allow mock admin
    return {
      isAdmin: true,
      userId: 'dev-admin-id',
    }
  }

  try {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return {
        isAdmin: false,
        userId: null,
        errorResponse: NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 }),
      }
    }

    const { data: profile, error: profileError } = await (supabase.from('profiles') as any)
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return {
        isAdmin: false,
        userId: user.id,
        errorResponse: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 }),
      }
    }

    return {
      isAdmin: true,
      userId: user.id,
    }
  } catch (error) {
    console.error('[nagrek] verifyAdmin error:', error)
    return {
      isAdmin: false,
      userId: null,
      errorResponse: NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    }
  }
}
