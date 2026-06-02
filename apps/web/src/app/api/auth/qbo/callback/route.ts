import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens } from '@/lib/qbo/oauth'
import { saveQboConnection } from '@/lib/qbo/connection'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${APP_URL}/settings?error=qbo_denied`)
  }

  if (!code || !realmId) {
    return NextResponse.redirect(`${APP_URL}/settings?error=qbo_missing_params`)
  }

  const savedState = request.cookies.get('qbo_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${APP_URL}/settings?error=qbo_state_mismatch`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  const { data: firmUser } = await adminClient
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .single()

  if (!firmUser) {
    return NextResponse.redirect(`${APP_URL}/settings?error=qbo_no_firm`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveQboConnection(firmUser.firm_id, realmId, tokens)
  } catch (err) {
    console.error('QBO callback error:', err)
    return NextResponse.redirect(`${APP_URL}/settings?error=qbo_exchange_failed`)
  }

  const response = NextResponse.redirect(`${APP_URL}/settings?connected=qbo`)
  response.cookies.delete('qbo_oauth_state')
  return response
}
