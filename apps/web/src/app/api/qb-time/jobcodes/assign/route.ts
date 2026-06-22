import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getFirmContext } from '@/lib/auth/firm'

// Maps a QB Time jobcode to a QBO customer in one self-service step:
//   1. find-or-create the billing client record (customers row + qbo_customer_id)
//   2. upsert the jobcode -> customer mapping
//   3. backfill customer_id onto the already-synced time entries for that jobcode
// so the user never has to hand-create customer records or re-sync.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { firmId } = ctx

  const body = await req.json().catch(() => ({}))
  const { jobcodeId, jobcodeName, qboCustomerId, qboCustomerName } = body as {
    jobcodeId?: string
    jobcodeName?: string
    qboCustomerId?: string
    qboCustomerName?: string
  }

  if (!jobcodeId || !qboCustomerId || !qboCustomerName) {
    return NextResponse.json(
      { error: 'jobcodeId, qboCustomerId and qboCustomerName are required' },
      { status: 400 }
    )
  }

  // 1. Find-or-create the customer for this QBO customer (scoped to the firm).
  const { data: existing } = await adminClient
    .from('customers')
    .select('id')
    .eq('firm_id', firmId)
    .eq('qbo_customer_id', qboCustomerId)
    .maybeSingle()

  let customerId = existing?.id ?? null
  if (!customerId) {
    const { data: created, error: createErr } = await adminClient
      .from('customers')
      .insert({
        firm_id: firmId,
        display_name: qboCustomerName,
        qbo_customer_id: qboCustomerId,
        is_high_touch: false,
        high_touch_buffer_minutes: 0,
        is_active: true,
      })
      .select('id')
      .single()

    if (createErr || !created) {
      return NextResponse.json(
        { error: `Failed to create customer: ${createErr?.message ?? 'unknown error'}` },
        { status: 500 }
      )
    }
    customerId = created.id
  }

  // 2. Upsert the jobcode -> customer mapping.
  const { error: mapErr } = await adminClient
    .from('customer_mappings')
    .upsert(
      {
        firm_id: firmId,
        customer_id: customerId,
        qb_time_source_type: 'jobcode',
        qb_time_source_id: jobcodeId,
        qb_time_source_name: jobcodeName ?? null,
      },
      { onConflict: 'firm_id,qb_time_source_type,qb_time_source_id' }
    )

  if (mapErr) {
    return NextResponse.json({ error: `Failed to save mapping: ${mapErr.message}` }, { status: 500 })
  }

  // 3. Backfill existing time entries for this jobcode so they're no longer unmapped.
  const { error: backfillErr } = await adminClient
    .from('time_entries')
    .update({ customer_id: customerId })
    .eq('firm_id', firmId)
    .eq('qb_time_jobcode_id', jobcodeId)

  if (backfillErr) {
    return NextResponse.json(
      { error: `Mapping saved, but updating existing entries failed: ${backfillErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, customerId })
}
