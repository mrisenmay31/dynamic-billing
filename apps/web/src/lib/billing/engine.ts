import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export interface DraftPayload {
  customerId: string
  rawSeconds: number
  roundedHours: number
  rate: number
  totalAmount: number
  description: string
}

export async function computeBillingDrafts(
  supabase: SupabaseClient<Database>,
  firmId: string,
  billingMonth: string, // 'YYYY-MM-01'
  firmDefaultRate: number,
  firmDefaultDescription: string
): Promise<DraftPayload[]> {
  const monthStart = billingMonth
  const [year, month] = billingMonth.split('-').map(Number)
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('customer_id, duration_seconds')
    .eq('firm_id', firmId)
    .eq('is_billable', true)
    .not('customer_id', 'is', null)
    .gte('started_at', monthStart)
    .lt('started_at', nextMonth)

  if (entriesError) throw new Error(`Failed to fetch time entries: ${entriesError.message}`)
  if (!entries || entries.length === 0) return []

  const secondsByCustomer = new Map<string, number>()
  for (const entry of entries) {
    const customerId = entry.customer_id!
    secondsByCustomer.set(customerId, (secondsByCustomer.get(customerId) ?? 0) + entry.duration_seconds)
  }

  const customerIds = Array.from(secondsByCustomer.keys())
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, hourly_rate_override, invoice_description_override')
    .in('id', customerIds)

  if (customersError) throw new Error(`Failed to fetch customers: ${customersError.message}`)

  const customerMap = new Map(
    (customers ?? []).map((c) => [c.id, c])
  )

  return customerIds.map((customerId) => {
    const rawSeconds = secondsByCustomer.get(customerId)!
    const roundedHours = Math.ceil(rawSeconds / 900) * 0.25
    const customer = customerMap.get(customerId)
    const rate = customer?.hourly_rate_override ?? firmDefaultRate
    const description = customer?.invoice_description_override ?? firmDefaultDescription
    const totalAmount = Math.round(roundedHours * rate * 100) / 100

    return { customerId, rawSeconds, roundedHours, rate, totalAmount, description }
  })
}
