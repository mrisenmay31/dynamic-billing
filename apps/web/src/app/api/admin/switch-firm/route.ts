import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit/log'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gate strictly on super_admins membership.
  const { data: superAdminRow } = await adminClient
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!superAdminRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Resolve caller's own firm for audit logging (may be null for headless super-admins,
  // but in practice Matt is always in firm_users for CTA Integrity).
  const { data: ownFirmUser } = await adminClient
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const body = await req.json().catch(() => ({}))
  const { firmId } = body as { firmId: string | null }

  if (!firmId) {
    // Clear the override — return to the super-admin's own firm.
    const response = NextResponse.json({ ok: true })
    response.cookies.delete('active_firm_id')

    if (ownFirmUser) {
      await logAudit({
        firmId: ownFirmUser.firm_id,
        userId: user.id,
        action: 'super_admin_firm_switch_cleared',
        entityType: 'firm',
        entityId: null,
        details: { cleared_by: user.id },
      })
    }

    return response
  }

  // Validate that the target firm exists.
  const { data: firm } = await adminClient
    .from('firms')
    .select('id')
    .eq('id', firmId)
    .maybeSingle()

  if (!firm) {
    return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('active_firm_id', firmId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // 8-hour work session
  })

  await logAudit({
    firmId,
    userId: user.id,
    action: 'super_admin_firm_switch',
    entityType: 'firm',
    entityId: firmId,
    details: { switched_to: firmId, switched_by: user.id },
  })

  return response
}
