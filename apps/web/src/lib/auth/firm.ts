import { cookies } from 'next/headers'
import { adminClient } from '@/lib/supabase/admin'
import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface FirmContext {
  userId: string
  firmId: string
  role: string
  isSuperAdmin: boolean
  isImpersonating: boolean
}

/** Returns true for roles with full access (owner or legacy admin). */
export function isOwner(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

/**
 * Resolves the authenticated user and the firm they belong to.
 *
 * This is the single source of truth for "which firm is this request acting on".
 * Replaces the previously hardcoded P&L firm ID so the app is multi-tenant: each
 * request operates on the firm linked to the logged-in user via `firm_users`.
 *
 * Super-admins may override the active firm via an httpOnly `active_firm_id` cookie
 * set by POST /api/admin/switch-firm. The cookie is ONLY honoured after confirming
 * the caller is in `super_admins` — a forged cookie from a non-super-admin has zero
 * effect.
 *
 * Returns null when there is no session, or the user is not a member of any firm.
 */
export async function getFirmContext(
  supabase: ServerClient
): Promise<FirmContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check super_admins first — one extra DB read on every request, but the table
  // will have O(1) rows so it's a sub-millisecond indexed lookup.
  const { data: superAdminRow } = await adminClient
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const isSuperAdmin = !!superAdminRow

  // If the caller is a super-admin, check for an active firm override cookie.
  // Security invariant: the cookie is ONLY consulted after confirming super_admins
  // membership above. Non-super-admins skip this block entirely.
  if (isSuperAdmin) {
    const cookieStore = await cookies()
    const activeFirmId = cookieStore.get('active_firm_id')?.value

    if (activeFirmId) {
      const { data: firm } = await adminClient
        .from('firms')
        .select('id')
        .eq('id', activeFirmId)
        .maybeSingle()

      if (firm) {
        return {
          userId: user.id,
          firmId: activeFirmId,
          role: 'admin',
          isSuperAdmin: true,
          isImpersonating: true,
        }
      }
    }
  }

  // Normal path — look up the firm this user belongs to.
  const { data: firmUser } = await adminClient
    .from('firm_users')
    .select('firm_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!firmUser) return null

  return {
    userId: user.id,
    firmId: firmUser.firm_id,
    role: firmUser.role ?? 'admin',
    isSuperAdmin,
    isImpersonating: false,
  }
}
