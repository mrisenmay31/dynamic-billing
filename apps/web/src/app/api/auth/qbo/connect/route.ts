import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizationUrl } from '@/lib/qbo/oauth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${request.nextUrl.origin}/login`)
  }

  const state = randomBytes(16).toString('hex')
  const authUrl = getAuthorizationUrl(state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('qbo_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    sameSite: 'lax',
    path: '/',
  })
  return response
}
