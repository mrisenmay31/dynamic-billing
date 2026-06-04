import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getQboConnectionStatus } from '@/lib/qbo/connection'
import InvoicesClient from './InvoicesClient'
import type { InvoicesClientProps } from './InvoicesClient'


const FIRM_ID = '00000000-0000-0000-0000-000000000001'
const DEFAULT_RATE = 125

function secondsToDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

function durationToAmount(duration: string, rate: number): number {
  const [h, m] = duration.split(':').map(Number)
  return Math.round((h + m / 60) * rate * 100) / 100
}

function formatEntryDate(startedAt: string): string {
  const d = new Date(startedAt)
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${month}/${day}`
}

export default async function InvoicesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: firm } = await supabase
    .from('firms')
    .select('default_hourly_rate')
    .eq('id', FIRM_ID)
    .single()

  const defaultRate = firm?.default_hourly_rate ?? DEFAULT_RATE

  const { data: billingRun } = await supabase
    .from('billing_runs')
    .select('id')
    .eq('firm_id', FIRM_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: drafts } = await supabase
    .from('invoice_drafts')
    .select('*, customers(id, display_name, invoice_description_override, is_high_touch, hourly_rate_override)')
    .eq('billing_run_id', billingRun?.id ?? '')
    .order('created_at', { ascending: true })

  const customerIds = (drafts ?? []).map((d) => d.customer_id)

  const { data: entries } = await supabase
    .from('time_entries')
    .select('*')
    .in('customer_id', customerIds)
    .order('started_at', { ascending: true })

  const templates: InvoicesClientProps['templates'] = (drafts ?? []).map((draft) => {
    const customer = draft.customers as { id: string; display_name: string; invoice_description_override: string | null; is_high_touch: boolean; hourly_rate_override: number | null }
    const customerEntries = (entries ?? []).filter((e) => e.customer_id === draft.customer_id)
    const rawMinutes = Math.round(customerEntries.reduce((sum, e) => sum + e.duration_seconds, 0) / 60)

    return {
      id: draft.customer_id,
      draftId: draft.id,
      client: customer.display_name,
      invoiceNum: draft.qbo_invoice_number ?? '',
      rawMinutes,
      defaultDescription: draft.description ?? customer.invoice_description_override ?? 'Monthly Bookkeeping',
      entries: customerEntries.map((e) => ({
        date: formatEntryDate(e.started_at),
        staff: e.staff_name ?? '',
        note: e.notes ?? '',
        duration: secondsToDuration(e.duration_seconds),
      })),
    }
  })

  const allEntries: InvoicesClientProps['allEntries'] = templates.flatMap((t) =>
    t.entries.map((e) => ({
      client: t.client,
      date: `${e.date}/2026`,
      employee: e.staff,
      productService: 'Hourly Accounting services',
      description: e.note,
      duration: e.duration,
      rate: defaultRate,
      billable: 'Yes',
      amount: durationToAmount(e.duration, defaultRate),
    }))
  )

  const { connected: qboConnected } = await getQboConnectionStatus(FIRM_ID)

  const { data: customers } = await supabase
    .from('customers')
    .select('id, display_name, qbo_customer_id')
    .eq('firm_id', FIRM_ID)
    .order('display_name')

  return (
    <InvoicesClient
      templates={templates}
      allEntries={allEntries}
      defaultRate={defaultRate}
      qboConnected={qboConnected}
      customers={(customers ?? []).map((c) => ({
        id: c.id,
        displayName: c.display_name,
        qboCustomerId: c.qbo_customer_id ?? null,
      }))}
    />
  )
}
