const INTUIT_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QBO_SCOPE = 'com.intuit.quickbooks.accounting'

function basicAuthHeader(): string {
  const credentials = Buffer.from(
    `${process.env.INTUIT_CLIENT_ID}:${process.env.INTUIT_CLIENT_SECRET}`
  ).toString('base64')
  return `Basic ${credentials}`
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INTUIT_CLIENT_ID!,
    response_type: 'code',
    scope: QBO_SCOPE,
    redirect_uri: process.env.INTUIT_REDIRECT_URI!,
    state,
  })
  return `${INTUIT_AUTH_URL}?${params.toString()}`
}

export interface QboTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
  token_type: string
}

async function postToTokenEndpoint(body: URLSearchParams): Promise<QboTokenResponse> {
  const res = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO token request failed ${res.status}: ${text}`)
  }

  return res.json() as Promise<QboTokenResponse>
}

export function exchangeCodeForTokens(code: string): Promise<QboTokenResponse> {
  return postToTokenEndpoint(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.INTUIT_REDIRECT_URI!,
  }))
}

export function refreshTokens(refreshToken: string): Promise<QboTokenResponse> {
  return postToTokenEndpoint(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }))
}
