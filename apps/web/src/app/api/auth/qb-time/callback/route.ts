import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens, saveQbTimeConnection } from '@/lib/qb-time/auth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/invoices?error=qb_time_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/invoices?error=qb_time_missing_params`)
  }

  const savedState = request.cookies.get('qb_time_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${origin}/invoices?error=qb_time_state_mismatch`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: firmUser } = await adminClient
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .single()

  if (!firmUser) {
    return NextResponse.redirect(`${origin}/invoices?error=qb_time_no_firm`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveQbTimeConnection(firmUser.firm_id, tokens)
  } catch (err) {
    console.error('QB Time callback error:', err)
    return NextResponse.redirect(`${origin}/invoices?error=qb_time_exchange_failed`)
  }

  const response = NextResponse.redirect(`${origin}/invoices?connected=qb_time`)
  response.cookies.delete('qb_time_oauth_state')
  return response
}
