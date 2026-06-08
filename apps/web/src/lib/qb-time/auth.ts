import { adminClient } from '@/lib/supabase/admin'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'

const QB_TIME_AUTH_URL = 'https://rest.tsheets.com/api/v1/authorize'
const QB_TIME_TOKEN_URL = 'https://rest.tsheets.com/api/v1/grant'

const REFRESH_BUFFER_MS = 5 * 60 * 1000

export interface QbTimeTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
  user_id: string
  company_id: string
  client_url: string
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QB_TIME_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.QB_TIME_REDIRECT_URI!,
    state,
  })
  return `${QB_TIME_AUTH_URL}?${params.toString()}`
}

async function postToTokenEndpoint(body: URLSearchParams): Promise<QbTimeTokenResponse> {
  const res = await fetch(QB_TIME_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QB Time token request failed ${res.status}: ${text}`)
  }

  return res.json() as Promise<QbTimeTokenResponse>
}

export function exchangeCodeForTokens(code: string): Promise<QbTimeTokenResponse> {
  return postToTokenEndpoint(new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.QB_TIME_CLIENT_ID!,
    client_secret: process.env.QB_TIME_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.QB_TIME_REDIRECT_URI!,
  }))
}

export function refreshQbTimeTokens(refreshToken: string): Promise<QbTimeTokenResponse> {
  return postToTokenEndpoint(new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.QB_TIME_CLIENT_ID!,
    client_secret: process.env.QB_TIME_CLIENT_SECRET!,
    refresh_token: refreshToken,
  }))
}

export async function saveQbTimeConnection(
  firmId: string,
  tokens: QbTimeTokenResponse
): Promise<void> {
  const now = new Date()
  const tokenExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000)

  const { error } = await adminClient
    .from('qb_time_connections')
    .upsert(
      {
        firm_id: firmId,
        access_token_encrypted: await encryptToken(tokens.access_token),
        refresh_token_encrypted: await encryptToken(tokens.refresh_token),
        token_expires_at: tokenExpiresAt.toISOString(),
        connected_at: now.toISOString(),
        last_refreshed_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'firm_id' }
    )

  if (error) throw new Error(`Failed to save QB Time connection: ${error.message}`)
}

export async function getValidQbTimeToken(firmId: string): Promise<string> {
  const { data, error } = await adminClient
    .from('qb_time_connections')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('firm_id', firmId)
    .single()

  if (error || !data) throw new Error(`No QB Time connection found for firm ${firmId}`)
  if (!data.access_token_encrypted || !data.refresh_token_encrypted) {
    throw new Error(`QB Time connection for firm ${firmId} has no tokens — reconnect required`)
  }

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : new Date(0)
  const needsRefresh = Date.now() >= expiresAt.getTime() - REFRESH_BUFFER_MS

  if (needsRefresh) {
    const refreshToken = await decryptToken(data.refresh_token_encrypted)
    const newTokens = await refreshQbTimeTokens(refreshToken)
    await saveQbTimeConnection(firmId, newTokens)
    return newTokens.access_token
  }

  return decryptToken(data.access_token_encrypted)
}

export async function getQbTimeConnectionStatus(
  firmId: string
): Promise<{ connected: boolean; connectedAt: string | null }> {
  const { data } = await adminClient
    .from('qb_time_connections')
    .select('access_token_encrypted, connected_at')
    .eq('firm_id', firmId)
    .maybeSingle()

  return {
    connected: !!(data?.access_token_encrypted),
    connectedAt: data?.connected_at ?? null,
  }
}
