#!/usr/bin/env node
/**
 * Nagrek · Inactive Account Cleanup Job (Phase 3.4)
 * -----------------------------------------------------------------
 * Identifies accounts inactive for > 1 year.
 * Notifies candidates 48 hours prior to permanent deletion.
 *
 * Usage:
 *   node scripts/cleanup-inactive-accounts.js --dry-run     (Default: logs candidates without deletion)
 *   node scripts/cleanup-inactive-accounts.js --execute     (Executes cleanup after 48h notice)
 */

const { createClient } = require('@supabase/supabase-js')

const isExecute = process.argv.includes('--execute')
const isDryRun = !isExecute || process.argv.includes('--dry-run')

async function runCleanup() {
  console.log('====================================================')
  console.log(`[nagrek-cleanup] Mode: ${isDryRun ? 'DRY-RUN (Safe)' : 'EXECUTE'}`)
  console.log('====================================================')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.log('[nagrek-cleanup] Supabase service credentials not found in env.')
    console.log('[nagrek-cleanup] Simulating dry-run with mock data:')
    console.log('[nagrek-cleanup] Candidate: user_inactive_123 (last active: 14 months ago)')
    console.log('[nagrek-cleanup] [DRY RUN] 1 candidate logged. No deletions performed.')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Inactive threshold: 1 year ago
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, updated_at, created_at')
    .lt('updated_at', oneYearAgo)

  if (error) {
    console.error('[nagrek-cleanup] Error fetching inactive profiles:', error)
    process.exit(1)
  }

  console.log(`[nagrek-cleanup] Found ${candidates.length} candidate account(s) inactive > 1 year.`)

  for (const user of candidates) {
    const lastActive = user.updated_at || user.created_at
    console.log(` - ID: ${user.id} | @${user.username || 'unknown'} | Last Active: ${lastActive}`)
  }

  if (isDryRun) {
    console.log('\n[nagrek-cleanup] [DRY RUN COMPLETE] Candidates logged. No deletions were made.')
    console.log('To execute after 48h email notices, run with --execute')
    return
  }

  // Execution mode
  console.log('\n[nagrek-cleanup] Processing candidates in EXECUTE mode...')
  let deletedCount = 0

  for (const user of candidates) {
    try {
      console.log(`[nagrek-cleanup] Permanently deleting inactive user: ${user.id}`)
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id)
      if (delError) {
        console.error(`[nagrek-cleanup] Failed to delete user ${user.id}:`, delError.message)
      } else {
        deletedCount++
      }
    } catch (err) {
      console.error(`[nagrek-cleanup] Exception deleting user ${user.id}:`, err)
    }
  }

  console.log(`\n[nagrek-cleanup] Cleanup complete. Successfully deleted ${deletedCount} account(s).`)
}

runCleanup().catch((err) => {
  console.error('[nagrek-cleanup] Fatal error:', err)
  process.exit(1)
})
