import { getValidQboToken } from '@/lib/qbo/connection'

function qboBase(): string {
  return process.env.INTUIT_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

async function fetchIncomeAccountRef(
  accessToken: string,
  realmId: string
): Promise<{ value: string; name: string }> {
  const query = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1")
  const url = `${qboBase()}/v3/company/${realmId}/query?query=${query}&minorversion=75`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO account query failed ${res.status}: ${text}`)
  }

  const data = await res.json() as { QueryResponse?: { Account?: { Id: string; Name: string }[] } }
  const accounts = data.QueryResponse?.Account ?? []

  if (accounts.length === 0) {
    throw new Error('No income accounts found in QBO — cannot create service item')
  }

  return { value: accounts[0].Id, name: accounts[0].Name }
}

export async function fetchOrCreateQboItemId(firmId: string, itemName: string): Promise<string> {
  const { accessToken, realmId } = await getValidQboToken(firmId)

  // Look for existing item by name
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
  const existing = data.QueryResponse?.Item ?? []

  if (existing.length > 0) {
    return existing[0].Id
  }

  // Item not found — create it
  const incomeAccount = await fetchIncomeAccountRef(accessToken, realmId)

  const createRes = await fetch(`${qboBase()}/v3/company/${realmId}/item?minorversion=75`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Name: itemName,
      Type: 'Service',
      IncomeAccountRef: incomeAccount,
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`QBO item creation failed ${createRes.status}: ${text}`)
  }

  const created = await createRes.json() as { Item: { Id: string } }
  return created.Item.Id
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

export async function fetchQboCustomerEmail(
  firmId: string,
  qboCustomerId: string
): Promise<string | null> {
  const { accessToken, realmId } = await getValidQboToken(firmId)
  const url = `${qboBase()}/v3/company/${realmId}/customer/${qboCustomerId}?minorversion=75`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO customer fetch failed ${res.status}: ${text}`)
  }

  const data = await res.json() as { Customer?: { PrimaryEmailAddr?: { Address?: string } } }
  return data.Customer?.PrimaryEmailAddr?.Address ?? null
}

export async function sendQboInvoice(
  firmId: string,
  invoiceId: string,
  sendTo: string
): Promise<void> {
  const { accessToken, realmId } = await getValidQboToken(firmId)
  const params = new URLSearchParams({ sendTo, minorversion: '75' })
  const url = `${qboBase()}/v3/company/${realmId}/invoice/${invoiceId}/send?${params}`

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
