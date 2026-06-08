import { getValidQboToken } from '@/lib/qbo/connection'

export interface QboCustomer {
  id: string
  displayName: string
}

function qboBase(): string {
  return process.env.INTUIT_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

export async function fetchQboCustomers(firmId: string): Promise<QboCustomer[]> {
  const { accessToken, realmId } = await getValidQboToken(firmId)

  const query = encodeURIComponent('SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000')
  const url = `${qboBase()}/v3/company/${realmId}/query?query=${query}&minorversion=75`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO customer fetch failed ${res.status}: ${text}`)
  }

  const data = await res.json()
  const customers: { Id: string; DisplayName: string }[] = data.QueryResponse?.Customer ?? []

  return customers.map((c) => ({ id: c.Id, displayName: c.DisplayName }))
}
