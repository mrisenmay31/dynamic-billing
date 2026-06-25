import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { assertQboWriteEnabled } from '@/lib/qbo/write-guard'
import { fetchOrCreateQboItemId, fetchQboCustomerEmail, createQboInvoice, sendQboInvoice } from '@/lib/qbo/invoices'
import { recomputeBillingRunStatus } from '@/lib/billing/run-status'
import { logAudit } from '@/lib/audit/log'
import { getFirmContext, isOwner } from '@/lib/auth/firm'

const QBO_ITEM_NAME = process.env.QBO_ITEM_NAME ?? 'Hourly Accounting services'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, firmId, role } = ctx

  if (!isOwner(role)) {
    return NextResponse.json({ error: 'Sending invoices is restricted to firm owners.' }, { status: 403 })
  }

  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const { rounded_hours, description } = body

  // Fetch draft with customer and billing run
  const { data: draft, error: fetchError } = await adminClient
    .from('invoice_drafts')
    .select('*, customers(qbo_customer_id, display_name), billing_runs(billing_month)')
    .eq('id', id)
    .single()

  if (fetchError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  // Tenant scope: a draft can only be sent by a member of the firm that owns it.
  if (draft.firm_id !== firmId) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  // Resolve final values — body overrides DB (flushes any in-flight debounce)
  const finalHours = typeof rounded_hours === 'number' ? rounded_hours : (draft.rounded_hours ?? 0)
  const finalDescription = typeof description === 'string' ? description : (draft.description ?? 'Monthly Bookkeeping')
  const finalAmount = Math.round(finalHours * draft.hourly_rate * 100) / 100

  // Idempotency: already sent
  if (draft.qbo_invoice_id) {
    return NextResponse.json({
      alreadySent: true,
      qboInvoiceId: draft.qbo_invoice_id,
      qboInvoiceNumber: draft.qbo_invoice_number,
    })
  }

  // Write guard
  try {
    await assertQboWriteEnabled(firmId)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 })
  }

  const customer = draft.customers as { qbo_customer_id: string | null; display_name: string }
  if (!customer.qbo_customer_id) {
    return NextResponse.json(
      { error: `Customer "${customer.display_name}" has no QBO customer ID — complete customer mapping first` },
      { status: 422 }
    )
  }

  const billingRun = draft.billing_runs as { billing_month: string }

  // Ensure idempotency key is persisted before calling QBO
  let idempotencyKey = draft.qbo_idempotency_key
  if (!idempotencyKey) {
    idempotencyKey = randomUUID()
    await adminClient
      .from('invoice_drafts')
      .update({ qbo_idempotency_key: idempotencyKey })
      .eq('id', id)
  }

  // Invoice date: first of the month following the billing month
  const billingDate = new Date(billingRun.billing_month + 'T00:00:00Z')
  billingDate.setUTCMonth(billingDate.getUTCMonth() + 1)
  const txnDate = billingDate.toISOString().slice(0, 10)
  const dueDate = new Date(billingDate.getTime() + 5 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)

  // Look up QBO item ID by name, creating it if it doesn't exist
  let itemId: string
  try {
    itemId = await fetchOrCreateQboItemId(firmId, QBO_ITEM_NAME)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }

  // Create invoice in QBO
  let invoiceResult: { invoiceId: string; invoiceNumber: string; intuitTid: string | null }
  try {
    invoiceResult = await createQboInvoice({
      firmId,
      qboCustomerId: customer.qbo_customer_id,
      itemId,
      qty: finalHours,
      unitPrice: draft.hourly_rate,
      description: finalDescription,
      txnDate,
      dueDate,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  // Fetch customer email from QBO — required for the send call
  let customerEmail: string | null
  try {
    customerEmail = await fetchQboCustomerEmail(firmId, customer.qbo_customer_id)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  if (!customerEmail) {
    await adminClient.from('invoice_drafts').update({
      qbo_invoice_id: invoiceResult.invoiceId,
      qbo_invoice_number: invoiceResult.invoiceNumber,
      status: 'error',
      last_error: `No email address for "${customer.display_name}" in QBO — add one to the customer record before sending invoices`,
      rounded_hours: finalHours,
      description: finalDescription,
      total_amount: finalAmount,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await recomputeBillingRunStatus(adminClient, draft.billing_run_id)

    return NextResponse.json(
      { error: `No email address for "${customer.display_name}" in QBO — add one to the customer record before sending invoices` },
      { status: 422 }
    )
  }

  // Send invoice via QBO — if this fails, preserve the invoice ID so we can track it
  let sendTid: string | null = null
  try {
    const sendResult = await sendQboInvoice(firmId, invoiceResult.invoiceId, customerEmail)
    sendTid = sendResult.intuitTid
  } catch (err) {
    await adminClient.from('invoice_drafts').update({
      qbo_invoice_id: invoiceResult.invoiceId,
      qbo_invoice_number: invoiceResult.invoiceNumber,
      status: 'error',
      last_error: (err as Error).message,
      rounded_hours: finalHours,
      description: finalDescription,
      total_amount: finalAmount,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await recomputeBillingRunStatus(adminClient, draft.billing_run_id)

    return NextResponse.json(
      { error: `Invoice created in QBO (ID: ${invoiceResult.invoiceId}) but email send failed: ${(err as Error).message}` },
      { status: 502 }
    )
  }

  // Success — write everything back
  const now = new Date().toISOString()
  await adminClient.from('invoice_drafts').update({
    qbo_invoice_id: invoiceResult.invoiceId,
    qbo_invoice_number: invoiceResult.invoiceNumber,
    status: 'sent',
    sent_at: now,
    rounded_hours: finalHours,
    description: finalDescription,
    total_amount: finalAmount,
    updated_at: now,
  }).eq('id', id)
  await recomputeBillingRunStatus(adminClient, draft.billing_run_id)

  // Record the Intuit trace IDs alongside the send so they're available for
  // any future support escalation with Intuit.
  await logAudit({
    firmId,
    userId,
    action: 'invoice_sent',
    entityType: 'invoice_draft',
    entityId: id,
    details: {
      qbo_invoice_id: invoiceResult.invoiceId,
      qbo_invoice_number: invoiceResult.invoiceNumber,
      create_intuit_tid: invoiceResult.intuitTid,
      send_intuit_tid: sendTid,
    },
  })

  return NextResponse.json({
    invoiceId: invoiceResult.invoiceId,
    invoiceNumber: invoiceResult.invoiceNumber,
    sentAt: now,
  })
}
