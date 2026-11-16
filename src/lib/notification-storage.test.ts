import { describe, expect, it, vi } from 'vitest'
import {
  defaultNotificationState,
  loadNotificationState,
  markNotificationRead,
  notificationStorageKey,
  saveNotificationState,
  setNotificationSound,
  setSoundEnabled,
  setSoundVolume,
  type StorageLike,
} from './notification-storage'

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('notificationStorageKey', () => {
  it('aísla el estado por usuario y espacio', () => {
    expect(notificationStorageKey('u1', 'w1')).not.toBe(notificationStorageKey('u2', 'w1'))
    expect(notificationStorageKey('u1', 'w1')).not.toBe(notificationStorageKey('u1', 'w2'))
    expect(notificationStorageKey('u1', 'w1')).toContain('u1')
  })
})

describe('defaultNotificationState', () => {
  it('parte de una ventana de 24 horas y el sonido activado', () => {
    const now = new Date('2026-01-02T12:00:00.000Z').getTime()
    const state = defaultNotificationState(now)
    expect(state.version).toBe(1)
    expect(state.soundEnabled).toBe(true)
    expect(state.soundVolume).toBe(0.7)
    expect(state.soundId).toBe('soft')
    expect(state.lastReadAt.pages).toBe('2026-01-01T12:00:00.000Z')
    expect(state.seenNotificationIds).toEqual([])
  })
})

describe('loadNotificationState', () => {
  it('devuelve el estado guardado', () => {
    const state = { ...defaultNotificationState(), soundEnabled: false }
    const storage = memoryStorage({
      [notificationStorageKey('u1', 'w1')]: JSON.stringify(state),
    })
    expect(loadNotificationState('u1', 'w1', storage)).toEqual(state)
  })

  it('tolera JSON inválido y estados incompletos', () => {
    const storage = memoryStorage({
      [notificationStorageKey('u1', 'w1')]: '{no-es-json',
      [notificationStorageKey('u2', 'w1')]: JSON.stringify({ soundEnabled: false }),
    })
    expect(loadNotificationState('u1', 'w1', storage).soundEnabled).toBe(true)
    expect(loadNotificationState('u2', 'w1', storage).soundEnabled).toBe(false)
    expect(loadNotificationState('u2', 'w1', storage).lastReadAt.files).toBeTruthy()
    expect(loadNotificationState('u2', 'w1', storage).soundVolume).toBe(0.7)
  })

  it('ajusta al rango válido el volumen guardado', () => {
    const storage = memoryStorage({
      [notificationStorageKey('u1', 'w1')]: JSON.stringify({ soundVolume: 4 }),
      [notificationStorageKey('u2', 'w1')]: JSON.stringify({ soundVolume: -2 }),
      [notificationStorageKey('u3', 'w1')]: JSON.stringify({ soundVolume: 'alto' }),
    })
    expect(loadNotificationState('u1', 'w1', storage).soundVolume).toBe(1)
    expect(loadNotificationState('u2', 'w1', storage).soundVolume).toBe(0)
    expect(loadNotificationState('u3', 'w1', storage).soundVolume).toBe(0.7)
  })

  it('acepta un sonido guardado válido y descarta uno desconocido', () => {
    const storage = memoryStorage({
      [notificationStorageKey('u1', 'w1')]: JSON.stringify({ soundId: 'marimba' }),
      [notificationStorageKey('u2', 'w1')]: JSON.stringify({ soundId: 'sonido-inventado' }),
    })
    expect(loadNotificationState('u1', 'w1', storage).soundId).toBe('marimba')
    expect(loadNotificationState('u2', 'w1', storage).soundId).toBe('soft')
  })

  it('no rompe si el almacenamiento lanza', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(() => loadNotificationState('u1', 'w1', storage)).not.toThrow()
    expect(() => saveNotificationState('u1', 'w1', defaultNotificationState(), storage)).not.toThrow()
  })
})

describe('markNotificationRead', () => {
  it('marca una clave sin mutar el estado anterior', () => {
    const before = defaultNotificationState()
    const after = markNotificationRead(before, 'channel:c1', '2026-01-02T10:00:00.000Z')
    expect(before.lastReadAt['channel:c1']).toBeUndefined()
    expect(after.lastReadAt['channel:c1']).toBe('2026-01-02T10:00:00.000Z')
  })

  it('no cambia nada si la marca ya es igual o anterior', () => {
    const before = markNotificationRead(
      defaultNotificationState(),
      'pages',
      '2026-01-02T10:00:00.000Z',
    )
    const after = markNotificationRead(before, 'pages', '2026-01-02T09:00:00.000Z')
    expect(after).toBe(before)
  })
})

describe('setSoundEnabled', () => {
  it('cambia la preferencia de sonido', () => {
    const state = setSoundEnabled(defaultNotificationState(), false)
    expect(state.soundEnabled).toBe(false)
  })
})

describe('setSoundVolume', () => {
  it('guarda el volumen dentro de 0 y 1', () => {
    expect(setSoundVolume(defaultNotificationState(), 0.35).soundVolume).toBe(0.35)
    expect(setSoundVolume(defaultNotificationState(), 2).soundVolume).toBe(1)
    expect(setSoundVolume(defaultNotificationState(), -1).soundVolume).toBe(0)
    expect(setSoundVolume(defaultNotificationState(), Number.NaN).soundVolume).toBe(0.7)
  })
})

describe('setNotificationSound', () => {
  it('cambia el sonido y descarta ids desconocidos', () => {
    expect(setNotificationSound(defaultNotificationState(), 'chime').soundId).toBe('chime')
    expect(setNotificationSound(defaultNotificationState(), 'nope' as never).soundId).toBe(
      'soft',
    )
  })
})

describe('saveNotificationState', () => {
  it('guarda y recarga el estado', () => {
    const storage = memoryStorage()
    const state = setSoundEnabled(defaultNotificationState(), false)
    saveNotificationState('u1', 'w1', state, storage)
    expect(loadNotificationState('u1', 'w1', storage).soundEnabled).toBe(false)
  })

  it('usa localStorage cuando no se inyecta almacenamiento', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    saveNotificationState('u1', 'w1', defaultNotificationState())
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
