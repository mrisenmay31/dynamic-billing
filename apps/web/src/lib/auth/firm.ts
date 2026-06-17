import { adminClient } from '@/lib/supabase/admin'
import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface FirmContext {
  userId: string
  firmId: string
}

/**
 * Resolves the authenticated user and the firm they belong to.
 *
 * This is the single source of truth for "which firm is this request acting on".
 * Replaces the previously hardcoded P&L firm ID so the app is multi-tenant: each
 * request operates on the firm linked to the logged-in user via `firm_users`.
 *
 * Returns null when there is no session, or the user is not a member of any firm.
 */
export async function getFirmContext(
  supabase: ServerClient
): Promise<FirmContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: firmUser } = await adminClient
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!firmUser) return null

  return { userId: user.id, firmId: firmUser.firm_id }
}
