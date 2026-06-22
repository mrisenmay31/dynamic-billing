import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getFirmContext } from '@/lib/auth/firm'

// Lists the QB Time jobcodes that have shown up in synced time entries, along
// with their current mapping status, so the Client Mapping UI can offer a
// one-time "map this jobcode to a QBO customer" workflow.
export async function GET() {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { firmId } = ctx

  const [{ data: entries }, { data: mappings }, { data: customers }] = await Promise.all([
    adminClient
      .from('time_entries')
      .select('qb_time_jobcode_id, qb_time_jobcode_name')
      .eq('firm_id', firmId)
      .not('qb_time_jobcode_id', 'is', null),
    adminClient
      .from('customer_mappings')
      .select('qb_time_source_id, customer_id')
      .eq('firm_id', firmId)
      .eq('qb_time_source_type', 'jobcode'),
    adminClient
      .from('customers')
      .select('id, display_name, qbo_customer_id')
      .eq('firm_id', firmId),
  ])

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]))
  const customerIdByJobcode = new Map((mappings ?? []).map((m) => [m.qb_time_source_id, m.customer_id]))

  // Collapse the time entries down to distinct jobcodes with an entry count.
  const seen = new Map<string, { jobcodeId: string; jobcodeName: string; entryCount: number }>()
  for (const e of entries ?? []) {
    const id = String(e.qb_time_jobcode_id)
    const existing = seen.get(id)
    if (existing) existing.entryCount += 1
    else seen.set(id, { jobcodeId: id, jobcodeName: e.qb_time_jobcode_name ?? id, entryCount: 1 })
  }

  const jobcodes = Array.from(seen.values())
    .map((j) => {
      const customerId = customerIdByJobcode.get(j.jobcodeId) ?? null
      const customer = customerId ? customerById.get(customerId) : null
      return {
        jobcodeId: j.jobcodeId,
        jobcodeName: j.jobcodeName,
        entryCount: j.entryCount,
        customerId,
        customerName: customer?.display_name ?? null,
        qboCustomerId: customer?.qbo_customer_id ?? null,
      }
    })
    .sort((a, b) => a.jobcodeName.localeCompare(b.jobcodeName))

  return NextResponse.json({ jobcodes })
}
