import { verifyFirebaseIdToken } from './auth'
import type { Env } from './env'
import { FirebaseFcmSender } from './fcm'
import { processEvent, processPending } from './processor'
import { checkRateLimit } from './rate-limit'
import { FirestoreStore } from './store'

function allowedOrigins(env: Env): string[] {
  return (env.PUSH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  if (!origin) return {}
  if (!allowedOrigins(env).includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    const cors = corsHeaders(env, origin)

    if (origin && !('access-control-allow-origin' in cors)) {
      return json({ error: 'Origen no permitido.' }, 403)
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    if (url.pathname === '/health') {
      return json({ ok: true }, 200, cors)
    }
    if (url.pathname !== '/notify' || request.method !== 'POST') {
      return json({ error: 'Not found' }, 404, cors)
    }

    const authorization = request.headers.get('authorization') ?? ''
    const match = authorization.match(/^Bearer\s+(.+)$/i)
    if (!match) return json({ error: 'Falta el token Bearer.' }, 401, cors)

    let uid: string
    try {
      const user = await verifyFirebaseIdToken(match[1].trim(), env.FIREBASE_PROJECT_ID)
      uid = user.uid
    } catch (error) {
      console.warn('[openqomu-push] token inválido', error)
      return json({ error: 'Token inválido.' }, 401, cors)
    }

    const limit = checkRateLimit(uid)
    if (!limit.allowed) {
      return json(
        { error: 'Demasiadas peticiones.' },
        429,
        { ...cors, 'retry-after': String(limit.retryAfter) },
      )
    }

    let outboxId: string
    try {
      const payload = (await request.json()) as { outboxId?: unknown }
      if (typeof payload.outboxId !== 'string' || !payload.outboxId.trim()) {
        return json({ error: 'Falta outboxId.' }, 400, cors)
      }
      outboxId = payload.outboxId.trim()
    } catch {
      return json({ error: 'JSON inválido.' }, 400, cors)
    }

    const store = new FirestoreStore(env)
    const event = await store.getEvent(outboxId)
    if (!event) return json({ error: 'El evento no existe.' }, 404, cors)
    if (event.createdBy !== uid || event.actorId !== uid) {
      return json({ error: 'El evento pertenece a otro usuario.' }, 403, cors)
    }

    const result = await processEvent(store, new FirebaseFcmSender(env), outboxId)
    return json({ result }, 200, cors)
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const store = new FirestoreStore(env)
    const fcm = new FirebaseFcmSender(env)
    ctx.waitUntil(
      processPending(store, fcm)
        .then((counts) => console.log('[openqomu-push] cron', counts))
        .catch((error) => console.error('[openqomu-push] cron', error)),
    )
  },
}
