import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizationUrl } from '@/lib/qbo/oauth'
import { getFirmContext, isOwner } from '@/lib/auth/firm'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const ctx = await getFirmContext(supabase)

  if (!ctx) {
    return NextResponse.redirect(`${request.nextUrl.origin}/login`)
  }

  if (!isOwner(ctx.role)) {
    return NextResponse.json({ error: 'Connecting integrations is restricted to firm owners.' }, { status: 403 })
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
