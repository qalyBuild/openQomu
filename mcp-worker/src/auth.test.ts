import { describe, expect, it } from 'vitest'
import { hashToken } from './auth'
import { checkRateLimit } from './rate-limit'

describe('hashToken', () => {
  it('genera el SHA-256 hexadecimal esperado', async () => {
    expect(await hashToken('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })
})

describe('checkRateLimit', () => {
  it('bloquea al superar el límite de la ventana', () => {
    const key = `test-${crypto.randomUUID()}`
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true)
    const blocked = checkRateLimit(key, 2, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })
})
