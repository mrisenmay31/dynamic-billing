// TODO (M2): Replace with real encryption using Supabase Vault or pgsodium
// before any OAuth tokens are stored. These stubs exist to establish the
// interface so call sites in M2+ can drop in the real implementation.

export async function encryptToken(plaintext: string): Promise<string> {
  return Buffer.from(plaintext).toString('base64')
}

export async function decryptToken(ciphertext: string): Promise<string> {
  return Buffer.from(ciphertext, 'base64').toString('utf-8')
}
