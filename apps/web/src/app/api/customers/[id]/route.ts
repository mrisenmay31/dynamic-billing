import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getFirmContext } from '@/lib/auth/firm'
import type { Database } from '@/types/supabase'

type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { firmId } = ctx

  const { id } = await params
  const body = await request.json()
  const { qbo_customer_id, exclude_from_billing } = body as {
    qbo_customer_id?: string | null
    exclude_from_billing?: boolean
  }

  if (exclude_from_billing !== undefined && typeof exclude_from_billing !== 'boolean') {
    return NextResponse.json({ error: 'exclude_from_billing must be a boolean' }, { status: 400 })
  }

  const patch: CustomerUpdate = { updated_at: new Date().toISOString() }
  if (qbo_customer_id !== undefined) patch.qbo_customer_id = qbo_customer_id
  if (exclude_from_billing !== undefined) patch.exclude_from_billing = exclude_from_billing

  const { error } = await adminClient
    .from('customers')
    .update(patch)
    .eq('id', id)
    .eq('firm_id', firmId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
