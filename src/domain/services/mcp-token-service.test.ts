import { describe, expect, it } from 'vitest'
import {
  MCP_TOKEN_PREFIX,
  generateMcpToken,
  hashMcpToken,
  normalizeScopes,
  validateTokenLabel,
} from './mcp-token-service'

describe('mcp-token-service', () => {
  it('genera tokens únicos con prefijo y hash estable', async () => {
    const first = await generateMcpToken()
    const second = await generateMcpToken()
    expect(first.token.startsWith(MCP_TOKEN_PREFIX)).toBe(true)
    expect(first.token).not.toBe(second.token)
    expect(first.hash).toBe(await hashMcpToken(first.token))
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('valida nombre y permisos', () => {
    expect(validateTokenLabel('  OpenCode  ')).toBe('OpenCode')
    expect(() => validateTokenLabel('   ')).toThrow('nombre')
    expect(normalizeScopes(['openqomu:read', 'openqomu:read'])).toEqual(['openqomu:read'])
    expect(() => normalizeScopes([])).toThrow('permiso')
  })
})
