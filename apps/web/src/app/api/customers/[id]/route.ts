import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

const FIRM_ID = '00000000-0000-0000-0000-000000000001'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { qbo_customer_id } = body as { qbo_customer_id: string | null }

  const { error } = await adminClient
    .from('customers')
    .update({ qbo_customer_id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('firm_id', FIRM_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
