import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getFirmContext } from '@/lib/auth/firm'
import type { Database } from '@/types/supabase'

type DraftUpdate = Database['public']['Tables']['invoice_drafts']['Update']

const ALLOWED_STATUSES = ['needs_review', 'ready_to_draft', 'approved', 'sent', 'error']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { firmId } = ctx

  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const { status, rounded_hours, description } = body

  const { data: existing, error: fetchError } = await adminClient
    .from('invoice_drafts')
    .select('id, hourly_rate')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  const update: DraftUpdate = { updated_at: new Date().toISOString() }

  if (status !== undefined) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = status
  }

  if (rounded_hours !== undefined) {
    if (typeof rounded_hours !== 'number' || rounded_hours < 0) {
      return NextResponse.json({ error: 'Invalid rounded_hours' }, { status: 400 })
    }
    update.rounded_hours = rounded_hours
    update.total_amount = Math.round(rounded_hours * existing.hourly_rate * 100) / 100
  }

  if (description !== undefined) {
    update.description = description
  }

  const { data: updated, error: updateError } = await adminClient
    .from('invoice_drafts')
    .update(update)
    .eq('id', id)
    .eq('firm_id', firmId)
    .select('id, status, rounded_hours, description, total_amount')
    .single()

  if (updateError) {
    console.error('[invoice-drafts] PATCH failed', updateError)
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
