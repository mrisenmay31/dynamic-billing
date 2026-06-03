import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { computeBillingDrafts } from '@/lib/billing/engine'
import { logAudit } from '@/lib/audit/log'

const FIRM_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const billingMonth: string = body.billingMonth ?? new Date().toISOString().slice(0, 7) + '-01'

  // Idempotency: return existing run if one already exists for this firm + month
  const { data: existing } = await adminClient
    .from('billing_runs')
    .select('id, billing_month, status, invoice_count, total_amount')
    .eq('firm_id', FIRM_ID)
    .eq('billing_month', billingMonth)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ billingRunId: existing.id, idempotent: true })
  }

  // Fetch firm defaults
  const { data: firm, error: firmError } = await adminClient
    .from('firms')
    .select('default_hourly_rate, default_invoice_description')
    .eq('id', FIRM_ID)
    .single()

  if (firmError || !firm) {
    return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  }

  // Compute drafts
  let drafts
  try {
    drafts = await computeBillingDrafts(
      adminClient,
      FIRM_ID,
      billingMonth,
      firm.default_hourly_rate,
      firm.default_invoice_description
    )
  } catch (err) {
    console.error('[billing-runs] engine error', err)
    return NextResponse.json({ error: 'Failed to compute billing drafts' }, { status: 500 })
  }

  if (drafts.length === 0) {
    return NextResponse.json({ error: 'No billable time entries found for this period' }, { status: 422 })
  }

  const totalAmount = drafts.reduce((sum, d) => sum + d.totalAmount, 0)

  // Create billing run
  const { data: run, error: runError } = await adminClient
    .from('billing_runs')
    .insert({
      firm_id: FIRM_ID,
      billing_month: billingMonth,
      status: 'pending',
      trigger: 'manual',
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      invoice_count: drafts.length,
      total_amount: totalAmount,
    })
    .select('id')
    .single()

  if (runError || !run) {
    console.error('[billing-runs] failed to create billing run', runError)
    return NextResponse.json({ error: 'Failed to create billing run' }, { status: 500 })
  }

  // Write invoice drafts
  const draftRows = drafts.map((d) => ({
    firm_id: FIRM_ID,
    billing_run_id: run.id,
    customer_id: d.customerId,
    status: 'needs_review',
    raw_hours: Math.round((d.rawSeconds / 3600) * 10000) / 10000,
    rounded_hours: d.roundedHours,
    hourly_rate: d.rate,
    total_amount: d.totalAmount,
    description: d.description,
  }))

  const { error: draftsError } = await adminClient
    .from('invoice_drafts')
    .insert(draftRows)

  if (draftsError) {
    console.error('[billing-runs] failed to insert invoice drafts', draftsError)
    // Roll back the billing run
    await adminClient.from('billing_runs').delete().eq('id', run.id)
    return NextResponse.json({ error: 'Failed to write invoice drafts' }, { status: 500 })
  }

  await logAudit({
    firmId: FIRM_ID,
    userId: user.id,
    action: 'billing_run_generated',
    entityType: 'billing_runs',
    entityId: run.id,
    details: { billingMonth, invoiceCount: drafts.length, totalAmount },
  })

  return NextResponse.json({ billingRunId: run.id, invoiceCount: drafts.length, totalAmount })
}
