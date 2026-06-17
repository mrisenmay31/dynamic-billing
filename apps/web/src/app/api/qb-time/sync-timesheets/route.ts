import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getValidQbTimeToken } from '@/lib/qb-time/auth'
import { getFirmContext } from '@/lib/auth/firm'

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

// Returns an ISO string for midnight Eastern Time on a YYYY-MM-DD date,
// correctly handling EDT (-04:00) vs EST (-05:00) based on the actual offset
// at noon UTC that day (safely away from any DST boundary at 2am).
function toEasternMidnightISO(dateStr: string): string {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`)
  const offsetStr = noonUtc
    .toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' })
    .match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? '-05:00'
  return `${dateStr}T00:00:00${offsetStr}`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { firmId } = ctx

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
    const token = await getValidQbTimeToken(firmId)
    const { timesheets, users, jobcodes } = await fetchTimesheets(token, start_date, end_date)

    // Load customer mappings for jobcode → customer_id lookup
    const { data: mappings } = await adminClient
      .from('customer_mappings')
      .select('qb_time_source_id, customer_id')
      .eq('firm_id', firmId)
      .eq('qb_time_source_type', 'jobcode')

    const jobcodeToCustomer = new Map<string, string>()
    for (const m of mappings ?? []) {
      jobcodeToCustomer.set(m.qb_time_source_id, m.customer_id)
    }

    for (const ts of timesheets) {
      try {
        const jc = jobcodes[String(ts.jobcode_id)]
        const customerId = jobcodeToCustomer.get(String(ts.jobcode_id)) ?? null

        // Clock-in/clock-out entries have a real start timestamp; duration-based
        // entries have null/invalid start — fall back to midnight Eastern on ts.date.
        const startedAt =
          ts.start && !Number.isNaN(new Date(ts.start).getTime())
            ? ts.start
            : toEasternMidnightISO(ts.date)

        const staffUser = users[String(ts.user_id)]
        const staffName = staffUser
          ? `${staffUser.first_name} ${staffUser.last_name}`.trim()
          : null

        const { error } = await adminClient
          .from('time_entries')
          .upsert(
            {
              firm_id: firmId,
              customer_id: customerId,
              qb_time_entry_id: String(ts.id),
              qb_time_jobcode_id: String(ts.jobcode_id),
              qb_time_jobcode_name: jc?.name ?? null,
              staff_name: staffName,
              started_at: startedAt,
              duration_seconds: ts.duration,
              is_billable: true,
              notes: ts.notes || null,
              source_payload: ts as unknown as import('@/types/supabase').Json,
              imported_at: new Date().toISOString(),
            },
            { onConflict: 'firm_id,qb_time_entry_id' }
          )

        if (error) {
          console.error(`[sync-timesheets] upsert error for entry ${ts.id}:`, error.message)
          skipped++
        } else {
          upserted++
        }
      } catch (entryErr) {
        console.error(`[sync-timesheets] unexpected error processing entry ${ts.id}:`, entryErr)
        skipped++
      }
    }

    await adminClient.from('integration_sync_logs').insert({
      firm_id: firmId,
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
    const error = err as Error
    const message = error.message ?? 'Unknown error'
    console.error('[sync-timesheets] fatal error:', error.stack ?? error)

    await adminClient.from('integration_sync_logs').insert({
      firm_id: firmId,
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
