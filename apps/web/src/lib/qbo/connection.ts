import { adminClient } from '@/lib/supabase/admin'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'
import { refreshTokens, type QboTokenResponse } from '@/lib/qbo/oauth'

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry

export async function saveQboConnection(
  firmId: string,
  realmId: string,
  tokens: QboTokenResponse
): Promise<void> {
  const now = new Date()
  const tokenExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000)

  const { error } = await adminClient
    .from('qbo_connections')
    .upsert(
      {
        firm_id: firmId,
        realm_id: realmId,
        access_token_encrypted: await encryptToken(tokens.access_token),
        refresh_token_encrypted: await encryptToken(tokens.refresh_token),
        token_expires_at: tokenExpiresAt.toISOString(),
        connected_at: now.toISOString(),
        last_refreshed_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'firm_id' }
    )

  if (error) throw new Error(`Failed to save QBO connection: ${error.message}`)
}

export async function getValidQboToken(
  firmId: string
): Promise<{ accessToken: string; realmId: string }> {
  const { data, error } = await adminClient
    .from('qbo_connections')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at, realm_id')
    .eq('firm_id', firmId)
    .single()

  if (error || !data) throw new Error(`No QBO connection found for firm ${firmId}`)
  if (!data.access_token_encrypted || !data.refresh_token_encrypted) {
    throw new Error(`QBO connection for firm ${firmId} has no tokens — reconnect required`)
  }

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : new Date(0)
  const needsRefresh = Date.now() >= expiresAt.getTime() - REFRESH_BUFFER_MS

  if (needsRefresh) {
    const refreshToken = await decryptToken(data.refresh_token_encrypted)
    const newTokens = await refreshTokens(refreshToken)
    await saveQboConnection(firmId, data.realm_id, newTokens)
    return { accessToken: newTokens.access_token, realmId: data.realm_id }
  }

  return {
    accessToken: await decryptToken(data.access_token_encrypted),
    realmId: data.realm_id,
  }
}

export async function getQboConnectionStatus(
  firmId: string
): Promise<{ connected: boolean; realmId: string | null }> {
  const { data } = await adminClient
    .from('qbo_connections')
    .select('realm_id, access_token_encrypted')
    .eq('firm_id', firmId)
    .maybeSingle()

  return {
    connected: !!(data?.access_token_encrypted),
    realmId: data?.realm_id ?? null,
  }
}
