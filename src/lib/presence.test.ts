import { describe, expect, it } from 'vitest'
import { isRecentlyActive, sortByPresence } from './presence'

describe('presence', () => {
  it('considera en línea a quien tuvo actividad reciente', () => {
    const now = Date.now()
    expect(isRecentlyActive(new Date(now - 60_000).toISOString())).toBe(true)
    expect(isRecentlyActive(new Date(now - 10 * 60_000).toISOString())).toBe(false)
    expect(isRecentlyActive(null)).toBe(false)
    expect(isRecentlyActive('fecha-inválida')).toBe(false)
  })

  it('ordena primero a las personas en línea', () => {
    const now = Date.now()
    const people = [
      { displayName: 'Zoe', lastActiveAt: new Date(now - 60 * 60_000).toISOString() },
      { displayName: 'Ana', lastActiveAt: new Date(now - 30_000).toISOString() },
      { displayName: 'Bruno', lastActiveAt: null },
      { displayName: 'Carla', lastActiveAt: new Date(now - 90_000).toISOString() },
    ]
    expect(sortByPresence(people).map((person) => person.displayName)).toEqual([
      'Ana',
      'Carla',
      'Bruno',
      'Zoe',
    ])
  })
})
