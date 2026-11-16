import { getDocument, updateDocument } from './firestore'
import type { Env } from './env'

export const MCP_TOKEN_PREFIX = 'openqomu_mcp_'
export const MCP_SCOPES = ['openqomu:read', 'openqomu:write'] as const
export type McpScope = (typeof MCP_SCOPES)[number]

export interface AuthProps {
  uid: string
  scopes: string[]
  tokenId: string
}

interface TokenDocument {
  uid?: string
  label?: string
  scopes?: string[]
  createdAt?: string
  lastUsedAt?: string | null
  revokedAt?: string | null
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyToken(env: Env, token: string): Promise<AuthProps | null> {
  if (!token.startsWith(MCP_TOKEN_PREFIX)) return null
  const tokenId = await hashToken(token)
  const document = await getDocument<TokenDocument>(env, `mcpTokens/${tokenId}`)
  if (!document) return null
  const data = document.data
  if (!data.uid || data.revokedAt) return null
  const scopes = Array.isArray(data.scopes) ? data.scopes.filter((scope) => typeof scope === 'string') : []
  if (scopes.length === 0) return null
  return { uid: data.uid, scopes, tokenId }
}

export function hasScope(props: AuthProps, scope: McpScope): boolean {
  return props.scopes.includes(scope)
}

export async function touchToken(env: Env, props: AuthProps): Promise<void> {
  try {
    const document = await getDocument<TokenDocument>(env, `mcpTokens/${props.tokenId}`)
    const lastUsedAt = document?.data.lastUsedAt
    if (lastUsedAt && Date.now() - Date.parse(lastUsedAt) < 5 * 60_000) return
    await updateDocument(env, `mcpTokens/${props.tokenId}`, {
      lastUsedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.warn('[openqomu-mcp] no se pudo actualizar lastUsedAt', error)
  }
}
