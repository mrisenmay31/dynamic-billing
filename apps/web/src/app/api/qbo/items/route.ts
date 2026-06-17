import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidQboToken } from '@/lib/qbo/connection'
import { redirect } from 'next/navigation'

const FIRM_ID = '00000000-0000-0000-0000-000000000001'

function qboBase(): string {
  return process.env.INTUIT_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accessToken, realmId } = await getValidQboToken(FIRM_ID)
  const query = encodeURIComponent('SELECT * FROM Item MAXRESULTS 100')
  const url = `${qboBase()}/v3/company/${realmId}/query?query=${query}&minorversion=75`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  const intuitTid = res.headers.get('intuit_tid')

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: `QBO query failed ${res.status}: ${text}`, intuit_tid: intuitTid },
      { status: 502 }
    )
  }

  const data = await res.json() as { QueryResponse?: { Item?: { Id: string; Name: string; Type: string }[] } }
  const items = (data.QueryResponse?.Item ?? []).map((i) => ({ id: i.Id, name: i.Name, type: i.Type }))

  return NextResponse.json({ items, intuit_tid: intuitTid })
}
