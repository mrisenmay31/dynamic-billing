import { getValidQboToken } from '@/lib/qbo/connection'

function qboBase(): string {
  return process.env.INTUIT_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

export async function fetchQboItemId(firmId: string, itemName: string): Promise<string> {
  const { accessToken, realmId } = await getValidQboToken(firmId)
  const query = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${itemName}'`)
  const url = `${qboBase()}/v3/company/${realmId}/query?query=${query}&minorversion=75`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO item query failed ${res.status}: ${text}`)
  }

  const data = await res.json() as { QueryResponse?: { Item?: { Id: string }[] } }
  const items = data.QueryResponse?.Item ?? []

  if (items.length === 0) {
    throw new Error(
      `QBO item '${itemName}' not found — verify the product/service name in QBO`
    )
  }

  return items[0].Id
}

export interface CreateInvoiceParams {
  firmId: string
  qboCustomerId: string
  itemId: string
  qty: number
  unitPrice: number
  description: string
  txnDate: string
  dueDate: string
}

export interface QboInvoiceResult {
  invoiceId: string
  invoiceNumber: string
}

export async function createQboInvoice(params: CreateInvoiceParams): Promise<QboInvoiceResult> {
  const { accessToken, realmId } = await getValidQboToken(params.firmId)
  const amount = Math.round(params.qty * params.unitPrice * 100) / 100

  const payload = {
    CustomerRef: { value: params.qboCustomerId },
    TxnDate: params.txnDate,
    DueDate: params.dueDate,
    Line: [
      {
        Amount: amount,
        DetailType: 'SalesItemLineDetail',
        Description: params.description,
        SalesItemLineDetail: {
          ItemRef: { value: params.itemId },
          UnitPrice: params.unitPrice,
          Qty: params.qty,
        },
      },
    ],
  }

  const url = `${qboBase()}/v3/company/${realmId}/invoice?minorversion=75`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO invoice creation failed ${res.status}: ${text}`)
  }

  const data = await res.json() as { Invoice: { Id: string; DocNumber: string } }
  return {
    invoiceId: data.Invoice.Id,
    invoiceNumber: data.Invoice.DocNumber,
  }
}

export async function sendQboInvoice(firmId: string, invoiceId: string): Promise<void> {
  const { accessToken, realmId } = await getValidQboToken(firmId)
  const url = `${qboBase()}/v3/company/${realmId}/invoice/${invoiceId}/send?minorversion=75`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO invoice send failed ${res.status}: ${text}`)
  }
}
