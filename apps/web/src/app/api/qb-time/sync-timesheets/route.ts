import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getValidQbTimeToken } from '@/lib/qb-time/auth'

const FIRM_ID = '00000000-0000-0000-0000-000000000001'
const QB_TIME_BASE = 'https://rest.tsheets.com/api/v1'
interface QbTimesheet {
  id: number
  user_id: number
  jobcode_id: number
  start: string
  end: string
  duration: number
  date: string
  on_the_clock: boolean
  notes: string
  type: string
}

interface QbUser {
  id: number
  first_name: string
  last_name: string
}

interface QbJobcode {
  id: number
  name: string
  billable: boolean
}

interface TimesheetPage {
  results: {
    timesheets: Record<string, QbTimesheet>
  }
  supplemental_data?: {
    users?: Record<string, QbUser>
    jobcodes?: Record<string, QbJobcode>
  }
  more: boolean
}

async function fetchTimesheets(
  token: string,
  startDate: string,
  endDate: string
): Promise<{ timesheets: QbTimesheet[]; users: Record<string, QbUser>; jobcodes: Record<string, QbJobcode> }> {
  const allTimesheets: QbTimesheet[] = []
  const allUsers: Record<string, QbUser> = {}
  const allJobcodes: Record<string, QbJobcode> = {}
  let page = 1
  let more = true

  while (more) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      on_the_clock: 'no',
      supplemental_data: 'yes',
      limit: '200',
      page: String(page),
    })

    const res = await fetch(`${QB_TIME_BASE}/timesheets?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`QB Time timesheets fetch failed ${res.status}: ${text}`)
    }

    const data = await res.json() as TimesheetPage

    const batch = Object.values(data.results?.timesheets ?? {})
    allTimesheets.push(...batch)

    Object.assign(allUsers, data.supplemental_data?.users ?? {})
    Object.assign(allJobcodes, data.supplemental_data?.jobcodes ?? {})

    more = data.more ?? false
    page++
  }

  return { timesheets: allTimesheets, users: allUsers, jobcodes: allJobcodes }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { start_date?: string; end_date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { start_date, end_date } = body
  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  }

  const startedAt = new Date().toISOString()
  let upserted = 0
  let skipped = 0

  try {
    const token = await getValidQbTimeToken(FIRM_ID)
    const { timesheets, users, jobcodes } = await fetchTimesheets(token, start_date, end_date)

    // Load customer mappings for jobcode → customer_id lookup
    const { data: mappings } = await adminClient
      .from('customer_mappings')
      .select('qb_time_source_id, customer_id')
      .eq('firm_id', FIRM_ID)
      .eq('qb_time_source_type', 'jobcode')

    const jobcodeToCustomer = new Map<string, string>()
    for (const m of mappings ?? []) {
      jobcodeToCustomer.set(m.qb_time_source_id, m.customer_id)
    }

    for (const ts of timesheets) {
      const jc = jobcodes[String(ts.jobcode_id)]

      // Filter non-billable entries client-side (jobcode must have billable=true if available)
      if (jc && jc.billable === false) {
        skipped++
        continue
      }

      const customerId = jobcodeToCustomer.get(String(ts.jobcode_id)) ?? null

      // Convert start to Eastern Time for the started_at timestamp
      const startedAtTs = new Date(ts.start).toISOString()

      const staffUser = users[String(ts.user_id)]
      const staffName = staffUser
        ? `${staffUser.first_name} ${staffUser.last_name}`.trim()
        : null

      const { error } = await adminClient
        .from('time_entries')
        .upsert(
          {
            firm_id: FIRM_ID,
            customer_id: customerId,
            qb_time_entry_id: String(ts.id),
            qb_time_jobcode_id: String(ts.jobcode_id),
            qb_time_jobcode_name: jc?.name ?? null,
            staff_name: staffName,
            started_at: startedAtTs,
            duration_seconds: ts.duration,
            is_billable: jc ? jc.billable : true,
            notes: ts.notes || null,
            source_payload: ts as unknown as import('@/types/supabase').Json,
            imported_at: new Date().toISOString(),
          },
          { onConflict: 'firm_id,qb_time_entry_id' }
        )

      if (error) {
        console.error('[sync-timesheets] upsert error:', error.message)
        skipped++
      } else {
        upserted++
      }
    }

    await adminClient.from('integration_sync_logs').insert({
      firm_id: FIRM_ID,
      integration: 'qb_time',
      operation: 'sync_timesheets',
      status: 'success',
      records_processed: timesheets.length,
      records_created: upserted,
      records_updated: 0,
      records_skipped: skipped,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      error_details: { start_date, end_date },
    })

    return NextResponse.json({ processed: timesheets.length, upserted, skipped })
  } catch (err) {
    const message = (err as Error).message ?? 'Unknown error'
    console.error('[sync-timesheets]', err)

    await adminClient.from('integration_sync_logs').insert({
      firm_id: FIRM_ID,
      integration: 'qb_time',
      operation: 'sync_timesheets',
      status: 'error',
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      records_skipped: 0,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      error_message: message,
      error_details: { start_date, end_date },
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
