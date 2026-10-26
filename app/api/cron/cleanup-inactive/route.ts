import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const dryRun = searchParams.get('dry_run') !== 'false'

    if (!isSupabaseServerConfigured) {
      return NextResponse.json({
        mode: dryRun ? 'dry-run' : 'execute',
        simulated: true,
        candidatesCount: 1,
        candidates: [
          {
            id: 'mock-user-inactive',
            username: 'inactive_diner',
            last_active: new Date(Date.now() - 400 * 86400000).toISOString(),
          },
        ],
        message: dryRun
          ? 'Dry run completed. 1 candidate logged. No deletions performed.'
          : 'Executed. 0 deleted in mock mode.',
      })
    }

    const supabase = getSupabaseServerClient()
    const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString()

    const { data: candidates, error } = await (supabase.from('profiles') as any)
      .select('id, username, display_name, updated_at, created_at')
      .lt('updated_at', oneYearAgo)

    if (error) {
      console.error('[nagrek] Cron fetch inactive error:', error)
      return NextResponse.json({ error: 'Failed to fetch inactive profiles' }, { status: 500 })
    }

    if (dryRun) {
      return NextResponse.json({
        mode: 'dry-run',
        candidatesCount: candidates?.length || 0,
        candidates: candidates || [],
        message: `Dry run completed. ${candidates?.length || 0} candidate(s) logged without deletion.`,
      })
    }

    // Execute mode
    let deleted = 0
    for (const c of candidates || []) {
      const { error: delError } = await supabase.auth.admin.deleteUser(c.id)
      if (!delError) deleted++
    }

    return NextResponse.json({
      mode: 'execute',
      candidatesCount: candidates?.length || 0,
      deletedCount: deleted,
      message: `Executed cleanup. Deleted ${deleted} inactive account(s).`,
    })
  } catch (error) {
    console.error('[nagrek] /api/cron/cleanup-inactive error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
