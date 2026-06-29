import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getQboConnectionStatus } from '@/lib/qbo/connection'
import { getQbTimeConnectionStatus } from '@/lib/qb-time/auth'
import InvoicesClient from './InvoicesClient'
import type { InvoicesClientProps } from './InvoicesClient'
import { adminClient } from '@/lib/supabase/admin'

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

// Returns 'YYYY-MM-01' for the previous calendar month in Eastern time.
// Eastern-based so a generate near a month boundary picks the correct work month.
function getPreviousMonthISO(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'numeric',
  }).formatToParts(new Date())
  const y = Number(parts.find(p => p.type === 'year')!.value)
  const m = Number(parts.find(p => p.type === 'month')!.value)
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  return `${prev.y}-${String(prev.m).padStart(2, '0')}-01`
}

export default async function InvoicesPage(
  { searchParams }: { searchParams: Promise<{ month?: string }> }
) {
  const { month } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve the firm for the logged-in user (multi-tenant). A logged-in user
  // with no firm membership is a misconfiguration, not an auth failure — surface
  // it rather than redirecting to /login (which would loop against middleware).
  const { data: firmUser } = await adminClient
    .from('firm_users')
    .select('firm_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!firmUser) {
    throw new Error('Your account is not linked to a firm. Contact support@ctaintegrity.com.')
  }
  const firmId = firmUser.firm_id
  const role: string = firmUser.role ?? 'admin'

  const { data: firm } = await supabase
    .from('firms')
    .select('name, default_hourly_rate')
    .eq('id', firmId)
    .single()

  const defaultRate = firm?.default_hourly_rate ?? DEFAULT_RATE
  const firmName = firm?.name ?? 'My Firm'

  const runQuery = supabase
    .from('billing_runs')
    .select('id, billing_month, status')
    .eq('firm_id', firmId)

  const { data: billingRun } = month
    ? await runQuery.eq('billing_month', month).maybeSingle()
    : await runQuery.order('billing_month', { ascending: false }).limit(1).maybeSingle()

  const { data: allRuns } = await supabase
    .from('billing_runs')
    .select('billing_month, status')
    .eq('firm_id', firmId)
    .order('billing_month', { ascending: false })

  const { data: drafts } = await supabase
    .from('invoice_drafts')
    .select('*, customers(id, display_name, invoice_description_override, is_high_touch, hourly_rate_override)')
    .eq('billing_run_id', billingRun?.id ?? '')
    .order('created_at', { ascending: true })

  const customerIds = (drafts ?? []).map((d) => d.customer_id)

  // Scope entries to the selected billing month to prevent data from other months bleeding through
  const bm = billingRun?.billing_month ?? null
  const bmParts = bm ? bm.split('-').map(Number) : null
  const nextMonth = bmParts
    ? (bmParts[1] === 12
      ? `${bmParts[0] + 1}-01-01`
      : `${bmParts[0]}-${String(bmParts[1] + 1).padStart(2, '0')}-01`)
    : null

  const { data: entries } = customerIds.length > 0 && bm && nextMonth
    ? await supabase
        .from('time_entries')
        .select('*')
        .in('customer_id', customerIds)
        .gte('started_at', bm)
        .lt('started_at', nextMonth)
        .order('started_at', { ascending: true })
    : { data: [] }

  const workYear = bm?.slice(0, 4) ?? ''

  const templates: InvoicesClientProps['templates'] = (drafts ?? []).map((draft) => {
    const customer = draft.customers as { id: string; display_name: string; invoice_description_override: string | null; is_high_touch: boolean; hourly_rate_override: number | null }
    const customerEntries = (entries ?? []).filter((e) => e.customer_id === draft.customer_id)
    const billableEntries = customerEntries.filter((e) => e.is_billable === true)
    const rawMinutes = Math.round(billableEntries.reduce((sum, e) => sum + e.duration_seconds, 0) / 60)

    return {
      id: draft.customer_id,
      draftId: draft.id,
      client: customer.display_name,
      invoiceNum: draft.qbo_invoice_number ?? '',
      rawMinutes,
      defaultDescription: draft.description ?? customer.invoice_description_override ?? 'Monthly Bookkeeping',
      sent: draft.status === 'sent',
      entries: customerEntries.map((e) => ({
        date: formatEntryDate(e.started_at),
        staff: e.staff_name ?? '',
        note: e.notes ?? '',
        duration: secondsToDuration(e.duration_seconds),
        billable: e.is_billable,
      })),
    }
  })

  const allEntries: InvoicesClientProps['allEntries'] = templates.flatMap((t) =>
    t.entries.filter((e) => e.billable !== false).map((e) => ({
      client: t.client,
      date: `${e.date}/${workYear}`,
      employee: e.staff,
      productService: 'Hourly Accounting services',
      description: e.note,
      duration: e.duration,
      rate: defaultRate,
      billable: 'Yes',
      amount: durationToAmount(e.duration, defaultRate),
    }))
  )

  const [{ connected: qboConnected }, { connected: qbTimeConnected, connectedAt: qbTimeConnectedAt }] = await Promise.all([
    getQboConnectionStatus(firmId),
    getQbTimeConnectionStatus(firmId),
  ])

  const { data: customers } = await supabase
    .from('customers')
    .select('id, display_name, qbo_customer_id')
    .eq('firm_id', firmId)
    .order('display_name')

  const defaultGenerateMonth = getPreviousMonthISO()

  // Raw time entries for the All Time Entries view — read directly from the
  // time_entries table for this firm, independent of any billing run, so every
  // synced QB Time entry shows up (including unmapped ones) across all months.
  const customerNameById = new Map((customers ?? []).map((c) => [c.id, c.display_name]))

  const { data: rawTimeEntries } = await supabase
    .from('time_entries')
    .select('started_at, staff_name, notes, duration_seconds, is_billable, qb_time_jobcode_name, customer_id')
    .eq('firm_id', firmId)
    .order('started_at', { ascending: true })

  const timeEntries: InvoicesClientProps['timeEntries'] = (rawTimeEntries ?? []).map((e) => {
    const d = new Date(e.started_at)
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mappedName = e.customer_id ? customerNameById.get(e.customer_id) ?? null : null
    const duration = secondsToDuration(e.duration_seconds)
    return {
      client: mappedName ?? (e.qb_time_jobcode_name ?? 'Unmapped'),
      date: `${mm}/${dd}/${yyyy}`,
      employee: e.staff_name ?? '',
      productService: 'Hourly Accounting services',
      description: e.notes ?? '',
      duration,
      rate: defaultRate,
      billable: e.is_billable ? 'Yes' : 'No',
      amount: durationToAmount(duration, defaultRate),
      month: `${yyyy}-${mm}`,
      isMapped: !!mappedName,
    }
  })

  return (
    <InvoicesClient
      templates={templates}
      allEntries={allEntries}
      timeEntries={timeEntries}
      defaultRate={defaultRate}
      qboConnected={qboConnected}
      qbTimeConnected={qbTimeConnected}
      qbTimeConnectedAt={qbTimeConnectedAt}
      firmName={firmName}
      role={role}
      currentRun={billingRun ? { billingMonth: billingRun.billing_month, status: billingRun.status } : null}
      availableRuns={(allRuns ?? []).map(r => ({ billingMonth: r.billing_month, status: r.status }))}
      defaultGenerateMonth={defaultGenerateMonth}
      customers={(customers ?? []).map((c) => ({
        id: c.id,
        displayName: c.display_name,
        qboCustomerId: c.qbo_customer_id ?? null,
      }))}
    />
  )
}
