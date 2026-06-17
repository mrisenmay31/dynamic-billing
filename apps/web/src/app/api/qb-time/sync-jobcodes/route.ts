import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getValidQbTimeToken } from '@/lib/qb-time/auth'
import { getFirmContext } from '@/lib/auth/firm'

const QB_TIME_BASE = 'https://rest.tsheets.com/api/v1'

interface QbJobcode {
  id: number
  name: string
  active: boolean
  parent_id: number
}

async function fetchAllJobcodes(token: string): Promise<QbJobcode[]> {
  const jobcodes: QbJobcode[] = []
  let page = 1
  let more = true

  while (more) {
    const params = new URLSearchParams({ active: 'yes', limit: '200', page: String(page) })
    const res = await fetch(`${QB_TIME_BASE}/jobcodes?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`QB Time jobcodes fetch failed ${res.status}: ${text}`)
    }

    const data = await res.json() as {
      results: { jobcodes: Record<string, QbJobcode> }
      more: boolean
    }

    const batch = Object.values(data.results?.jobcodes ?? {})
    jobcodes.push(...batch)
    more = data.more ?? false
    page++
  }

  return jobcodes
}

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { firmId } = ctx

  const startedAt = new Date().toISOString()
  let added = 0
  let skipped = 0

  try {
    const token = await getValidQbTimeToken(firmId)
    const jobcodes = await fetchAllJobcodes(token)

    for (const jc of jobcodes) {
      const { data: existing } = await adminClient
        .from('customer_mappings')
        .select('id')
        .eq('firm_id', firmId)
        .eq('qb_time_source_type', 'jobcode')
        .eq('qb_time_source_id', String(jc.id))
        .maybeSingle()

      if (existing) {
        // Update name if it changed, but never overwrite the customer_id mapping
        await adminClient
          .from('customer_mappings')
          .update({ qb_time_source_name: jc.name })
          .eq('id', existing.id)
        skipped++
      } else {
        // Insert without customer_id — user must map manually
        const { data: customers } = await adminClient
          .from('customers')
          .select('id, display_name')
          .eq('firm_id', firmId)

        // Auto-match by name (case-insensitive)
        const match = (customers ?? []).find(
          (c) => c.display_name.toLowerCase() === jc.name.toLowerCase()
        )

        if (match) {
          const { error } = await adminClient
            .from('customer_mappings')
            .insert({
              firm_id: firmId,
              customer_id: match.id,
              qb_time_source_type: 'jobcode',
              qb_time_source_id: String(jc.id),
              qb_time_source_name: jc.name,
            })
          if (!error) added++
          else skipped++
        } else {
          skipped++
        }
      }
    }

    await adminClient.from('integration_sync_logs').insert({
      firm_id: firmId,
      integration: 'qb_time',
      operation: 'sync_jobcodes',
      status: 'success',
      records_processed: jobcodes.length,
      records_created: added,
      records_updated: skipped,
      records_skipped: 0,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({ jobcodes: jobcodes.length, added, skipped })
  } catch (err) {
    const message = (err as Error).message ?? 'Unknown error'
    console.error('[sync-jobcodes]', err)

    await adminClient.from('integration_sync_logs').insert({
      firm_id: firmId,
      integration: 'qb_time',
      operation: 'sync_jobcodes',
      status: 'error',
      records_processed: 0,
      records_created: added,
      records_updated: 0,
      records_skipped: 0,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      error_message: message,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
