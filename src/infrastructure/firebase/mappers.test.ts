import { describe, expect, it } from 'vitest'
import { mapUser } from './mappers'

describe('mapUser', () => {
  it('lee el tema elegido por el usuario', () => {
    const user = mapUser('u-1', {
      displayName: 'Alex',
      email: 'alex@qomu.app',
      createdAt: '2026-01-01T00:00:00.000Z',
      themeId: 'monokai',
    })
    expect(user.themeId).toBe('monokai')
  })

  it('deja el tema vacío si no existe', () => {
    const user = mapUser('u-1', {
      displayName: 'Alex',
      email: 'alex@qomu.app',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(user.themeId).toBeUndefined()
  })
})
