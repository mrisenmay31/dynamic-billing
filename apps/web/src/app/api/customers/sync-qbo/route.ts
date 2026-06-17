import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { fetchQboCustomers } from '@/lib/qbo/customers'
import { getFirmContext } from '@/lib/auth/firm'

export async function POST() {
  try {
    const supabase = await createClient()
    const ctx = await getFirmContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { firmId } = ctx

    const qboCustomers = await fetchQboCustomers(firmId)

    const { data: dbCustomers, error: dbErr } = await adminClient
      .from('customers')
      .select('id, display_name, qbo_customer_id')
      .eq('firm_id', firmId)

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    if (!dbCustomers) return NextResponse.json({ error: 'No customers found' }, { status: 500 })

    let autoMatched = 0
    for (const dbCustomer of dbCustomers) {
      if (dbCustomer.qbo_customer_id) continue

      const match = qboCustomers.find(
        (q) => q.displayName.toLowerCase() === dbCustomer.display_name.toLowerCase()
      )
      if (match) {
        await adminClient
          .from('customers')
          .update({ qbo_customer_id: match.id, updated_at: new Date().toISOString() })
          .eq('id', dbCustomer.id)
        autoMatched++
      }
    }

    const { data: updatedCustomers } = await adminClient
      .from('customers')
      .select('id, display_name, qbo_customer_id')
      .eq('firm_id', firmId)
      .order('display_name')

    return NextResponse.json({ qboCustomers, customers: updatedCustomers ?? [], autoMatched })
  } catch (err) {
    console.error('[sync-qbo]', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Unknown error' }, { status: 500 })
  }
}
