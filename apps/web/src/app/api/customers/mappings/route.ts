import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

const FIRM_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await adminClient
    .from('customer_mappings')
    .select('*, customers(display_name)')
    .eq('firm_id', FIRM_ID)
    .order('created_at')

  return NextResponse.json({ mappings: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId, qbtJobcodeId, qbtJobcodeName } = await request.json() as {
    customerId: string
    qbtJobcodeId: string
    qbtJobcodeName: string
  }

  const { data, error } = await adminClient
    .from('customer_mappings')
    .upsert(
      {
        firm_id: FIRM_ID,
        customer_id: customerId,
        qb_time_source_type: 'jobcode',
        qb_time_source_id: qbtJobcodeId,
        qb_time_source_name: qbtJobcodeName,
      },
      { onConflict: 'firm_id,qb_time_source_type,qb_time_source_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ mapping: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json() as { id: string }

  const { error } = await adminClient
    .from('customer_mappings')
    .delete()
    .eq('id', id)
    .eq('firm_id', FIRM_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
