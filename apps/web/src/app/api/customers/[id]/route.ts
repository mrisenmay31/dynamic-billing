import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getFirmContext } from '@/lib/auth/firm'

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
  const { qbo_customer_id } = body as { qbo_customer_id: string | null }

  const { error } = await adminClient
    .from('customers')
    .update({ qbo_customer_id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('firm_id', firmId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
