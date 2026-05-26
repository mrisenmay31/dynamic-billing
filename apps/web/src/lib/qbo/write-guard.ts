import { adminClient } from '@/lib/supabase/admin'

export async function assertQboWriteEnabled(firmId: string): Promise<void> {
  const { data, error } = await adminClient
    .from('firms')
    .select('qbo_write_enabled')
    .eq('id', firmId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch firm ${firmId}: ${error.message}`)
  }

  if (!data.qbo_write_enabled) {
    throw new Error(`QBO write operations are disabled for firm ${firmId}`)
  }
}
