// Documento público: no debe contener secretos. Edita la skill canónica y ejecuta `npm run skill:sync`.
import { SKILL_MARKDOWN } from './skill-content'

export const SKILL_PATH = '/skill/SKILL.md'

/** FNV-1a de 32 bits: suficiente para un ETag de contenido estático. */
function contentEtag(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `"${(hash >>> 0).toString(16)}"`
}

const SKILL_ETAG = contentEtag(SKILL_MARKDOWN)

const SKILL_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'cache-control': 'public, max-age=300',
  etag: SKILL_ETAG,
  'x-content-type-options': 'nosniff',
  'access-control-allow-origin': '*',
}

function markdownResponse(request: Request): Response {
  if (request.headers.get('if-none-match') === SKILL_ETAG) {
    return new Response(null, { status: 304, headers: SKILL_HEADERS })
  }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: SKILL_HEADERS })
  }
  return new Response(SKILL_MARKDOWN, { status: 200, headers: SKILL_HEADERS })
}

/**
 * Sirve la skill de instalación sin autenticación.
 * Devuelve `null` cuando la ruta no es de la skill, para no interferir con `/mcp`.
 */
export function handleSkillRequest(request: Request, url: URL): Response | null {
  if (url.pathname === '/skill' || url.pathname === '/skill/') {
    return Response.redirect(new URL(SKILL_PATH, url).toString(), 302)
  }

  if (url.pathname !== SKILL_PATH) return null

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return markdownResponse(request)
}
