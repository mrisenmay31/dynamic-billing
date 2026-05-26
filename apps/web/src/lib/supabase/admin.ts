import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

if (typeof window !== 'undefined') {
  throw new Error('admin supabase client must not be imported in browser code')
}

export const adminClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
