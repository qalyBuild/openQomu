import type { McpScope } from '@/domain/entities/ai'
import { MCP_SCOPE_VALUES } from '@/domain/entities/ai'
import { ValidationError } from '@/domain/errors'

export const MCP_TOKEN_PREFIX = 'openqomu_mcp_'
const TOKEN_BYTES = 32

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function validateTokenLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) throw new ValidationError('Ponle un nombre al token.')
  if (trimmed.length > 60) throw new ValidationError('El nombre no puede superar 60 caracteres.')
  return trimmed
}

export function normalizeScopes(scopes: McpScope[]): McpScope[] {
  const unique = [...new Set(scopes)]
  if (unique.length === 0) throw new ValidationError('Selecciona al menos un permiso.')
  if (unique.some((scope) => !(MCP_SCOPE_VALUES as readonly string[]).includes(scope))) {
    throw new ValidationError('Alguna de las acciones no es válida.')
  }
  return unique
}

export async function hashMcpToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return toHex(new Uint8Array(digest))
}

export async function generateMcpToken(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  const token = `${MCP_TOKEN_PREFIX}${base64Url(bytes)}`
  return { token, hash: await hashMcpToken(token) }
}
