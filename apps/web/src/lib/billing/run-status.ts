import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Recomputes a billing run's status from its drafts and writes it.
 * pending = none sent, partially_sent = some sent, sent = all sent.
 * Best-effort: never throws into the send flow.
 */
export async function recomputeBillingRunStatus(
  adminClient: SupabaseClient<Database>,
  billingRunId: string
): Promise<void> {
  try {
    const { data: drafts } = await adminClient
      .from('invoice_drafts')
      .select('status')
      .eq('billing_run_id', billingRunId)

    const total = drafts?.length ?? 0
    if (total === 0) return
    const sentCount = (drafts ?? []).filter(d => d.status === 'sent').length
    const status =
      sentCount === 0 ? 'pending' : sentCount === total ? 'sent' : 'partially_sent'

    await adminClient
      .from('billing_runs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', billingRunId)
  } catch (err) {
    console.error('[run-status] failed to recompute billing run status', err)
    // swallow — the invoice already sent successfully; status sync is non-critical
  }
}
