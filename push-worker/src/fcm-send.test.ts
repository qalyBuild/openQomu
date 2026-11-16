import { afterEach, describe, expect, it, vi } from 'vitest'
import { FirebaseFcmSender } from './fcm'
import type { Env } from './env'

const env = {
  FIREBASE_PROJECT_ID: 'openqomu-app',
  FCM_PROJECT_ID: 'openqomu-app',
  FIREBASE_SERVICE_ACCOUNT: '{}',
} satisfies Env

const content = { id: 'e1', title: 'Título', body: 'Cuerpo', path: '/w/1/c/2' }
const tokenProvider = async () => 'access-token'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FirebaseFcmSender', () => {
  it('cuenta las entregas correctas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    )
    const sender = new FirebaseFcmSender(env, tokenProvider)
    const result = await sender.send(['tok-1', 'tok-2'], content)
    expect(result).toEqual({ delivered: 2, invalidTokens: [] })
  })

  it('usa el payload con notificación para APK antiguas', async () => {
    let body: Record<string, unknown> = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        body = JSON.parse(String(init?.body))
        return new Response('{}', { status: 200 })
      }),
    )
    const sender = new FirebaseFcmSender(env, tokenProvider)
    await sender.send(['tok-viejo'], content, true)
    expect(body).toMatchObject({
      message: {
        notification: { title: 'Título', body: 'Cuerpo' },
        data: { path: '/w/1/c/2' },
      },
    })
  })

  it('marca como inválidos los tokens no registrados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }), {
            status: 404,
          }),
      ),
    )
    const sender = new FirebaseFcmSender(env, tokenProvider)
    const result = await sender.send(['tok-viejo'], content)
    expect(result.delivered).toBe(0)
    expect(result.invalidTokens).toEqual(['tok-viejo'])
  })

  it('lanza error si FCM rechaza la autenticación', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('permission denied', { status: 403 })),
    )
    const sender = new FirebaseFcmSender(env, tokenProvider)
    await expect(sender.send(['tok-1'], content)).rejects.toThrow('FCM falló')
  })

  it('no lanza si al menos una entrega funciona', async () => {
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        return call === 1
          ? new Response('{}', { status: 200 })
          : new Response('boom', { status: 500 })
      }),
    )
    const sender = new FirebaseFcmSender(env, tokenProvider)
    const result = await sender.send(['ok', 'fail'], content)
    expect(result.delivered).toBe(1)
  })
})
