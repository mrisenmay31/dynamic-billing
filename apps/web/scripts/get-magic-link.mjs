import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: 'matt@ctaintegrity.com',
  options: {
    redirectTo: 'https://dynamic-billing.vercel.app/auth/callback',
  },
})

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

console.log('\nOpen this URL in your browser:\n')
console.log(data.properties.action_link)
console.log()
