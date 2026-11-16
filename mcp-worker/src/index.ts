import { createMcpHandler } from 'agents/mcp/server'
import { touchToken, verifyToken } from './auth'
import type { Env } from './env'
import { checkRateLimit } from './rate-limit'
import { createServer } from './server'
import { handleSkillRequest } from './skill'

const CORS_HEADERS = {
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers':
    'authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-max-age': '86400',
}

function unauthorized(message: string): Response {
  return new Response(message, {
    status: 401,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'www-authenticate': 'Bearer realm="openqomu"',
    },
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Skill pública de instalación: se sirve sin token para que cualquier agente pueda descargarla.
    const skill = handleSkillRequest(request, url)
    if (skill) return skill

    if (url.pathname !== '/mcp') {
      return new Response('Not found', { status: 404 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          'access-control-allow-origin': request.headers.get('origin') ?? '*',
        },
      })
    }

    const authorization = request.headers.get('authorization') ?? ''
    const match = authorization.match(/^Bearer\s+(.+)$/i)
    if (!match) return unauthorized('Falta el token Bearer.')

    let auth
    try {
      auth = await verifyToken(env, match[1].trim())
    } catch (error) {
      console.error('[openqomu-mcp] verify token', error)
      return new Response('No se pudo verificar el token.', { status: 500 })
    }
    if (!auth) return unauthorized('Token inválido o revocado.')

    const limit = checkRateLimit(auth.tokenId)
    if (!limit.allowed) {
      return new Response('Demasiadas peticiones. Inténtalo de nuevo más tarde.', {
        status: 429,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'retry-after': String(limit.retryAfter),
        },
      })
    }

    ctx.waitUntil(touchToken(env, auth))

    const allowedHostnames = env.MCP_ALLOWED_HOSTS
      ? env.MCP_ALLOWED_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
      : undefined

    const handler = createMcpHandler(createServer, {
      authContext: { props: { ...auth } },
      ...(allowedHostnames ? { allowedHostnames } : {}),
    })

    return handler(request, env, ctx)
  },
}
