import { describe, expect, it } from 'vitest'
import type { Env } from './env'
import {
  DELETED_MESSAGE_TTL_MS,
  INVITE_COLLECTIONS,
  purgeDeletedMessages,
  purgeExpiredInvites,
} from './purge'

const env = { FIREBASE_PROJECT_ID: 'qomu-app', FIREBASE_SERVICE_ACCOUNT: '{}' } satisfies Env
const NOW = Date.parse('2026-01-01T12:00:00.000Z')

describe('purgeDeletedMessages', () => {
  it('pide como corte una hora antes y borra lo devuelto', async () => {
    const removed: string[] = []
    let cutoff = ''
    const count = await purgeDeletedMessages(env, NOW, {
      listExpired: async (value) => {
        cutoff = value
        return [{ path: 'workspaces/w1/channels/c1/messages/m1' }]
      },
      listExpiredIn: async () => [],
      remove: async (path) => {
        removed.push(path)
      },
    })
    expect(cutoff).toBe(new Date(NOW - DELETED_MESSAGE_TTL_MS).toISOString())
    expect(removed).toEqual(['workspaces/w1/channels/c1/messages/m1'])
    expect(count).toBe(1)
  })

  it('no borra nada si no hay mensajes caducados', async () => {
    const count = await purgeDeletedMessages(env, NOW, {
      listExpired: async () => [],
      listExpiredIn: async () => [],
      remove: async () => {
        throw new Error('no debería borrar')
      },
    })
    expect(count).toBe(0)
  })
})

describe('purgeExpiredInvites', () => {
  it('recorre las colecciones de invitaciones con el corte actual', async () => {
    const calls: Array<[string, number]> = []
    const removed: string[] = []
    const count = await purgeExpiredInvites(env, NOW, {
      listExpired: async () => [],
      listExpiredIn: async (collection, cutoffMs) => {
        calls.push([collection, cutoffMs])
        return collection === 'accessInvites' ? [{ path: 'accessInvites/a@example.com' }] : []
      },
      remove: async (path) => {
        removed.push(path)
      },
    })
    expect(calls).toEqual(INVITE_COLLECTIONS.map((collection) => [collection, NOW]))
    expect(removed).toEqual(['accessInvites/a@example.com'])
    expect(count).toBe(1)
  })
})
