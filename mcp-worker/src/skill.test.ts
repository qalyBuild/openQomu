import { describe, expect, it } from 'vitest'
import worker from './index'
import type { Env } from './env'
import { SKILL_MARKDOWN } from './skill-content'

const env = {
  FIREBASE_PROJECT_ID: 'openqomu-app',
  FIREBASE_SERVICE_ACCOUNT: '{}',
} satisfies Env

function makeContext(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext
}

function call(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`https://openqomu.example${path}`, init), env, makeContext())
}

describe('skill pública', () => {
  it('sirve el SKILL.md sin autenticación', async () => {
    const response = await call('/skill/SKILL.md')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(response.headers.get('etag')).toBeTruthy()

    const body = await response.text()
    expect(body).toBe(SKILL_MARKDOWN)
    expect(body.startsWith('---\nname: openQomu\n')).toBe(true)
  })

  it('responde HEAD sin body', async () => {
    const response = await call('/skill/SKILL.md', { method: 'HEAD' })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })

  it('devuelve 304 si el ETag coincide', async () => {
    const first = await call('/skill/SKILL.md')
    const etag = first.headers.get('etag') ?? ''
    const second = await call('/skill/SKILL.md', { headers: { 'if-none-match': etag } })

    expect(second.status).toBe(304)
  })

  it('redirige /skill y /skill/ a la ruta canónica', async () => {
    for (const path of ['/skill', '/skill/']) {
      const response = await call(path)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('https://openqomu.example/skill/SKILL.md')
    }
  })

  it('rechaza métodos de escritura', async () => {
    const response = await call('/skill/SKILL.md', { method: 'POST' })

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
  })

  it('no publica secretos', () => {
    expect(SKILL_MARKDOWN).not.toContain('openqomu_mcp_')
    expect(SKILL_MARKDOWN).not.toContain('BEGIN PRIVATE KEY')
    expect(SKILL_MARKDOWN).not.toContain('service_account')
  })
})

describe('gate de /mcp', () => {
  it('sigue exigiendo token Bearer', async () => {
    const response = await call('/mcp', { method: 'POST' })

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('Bearer')
  })

  it('mantiene el 404 en rutas desconocidas', async () => {
    const response = await call('/otra-cosa')

    expect(response.status).toBe(404)
  })
})
