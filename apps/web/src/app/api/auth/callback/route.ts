import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/invoices'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  if (code) {
    // Pre-create the redirect response so we can set session cookies directly on it.
    // Using cookies() from next/headers here does NOT work — those cookies don't
    // attach to a NextResponse.redirect() object returned later.
    const redirectResponse = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              redirectResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return redirectResponse
    }
  }

  return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
}
