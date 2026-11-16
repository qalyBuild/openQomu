import { deleteObject, getObject, objectKey, putObject } from './s3'
import { MAX_UPLOAD_BYTES, SIGNED_URL_TTL_SECONDS, type Env } from './env'
import { verifyIdToken } from './firebase'
import { getFileOwner, getMemberRole, isWorkspaceMember } from './firestore'
import { signFileUrl, verifyFileUrl } from './signed-url'

const ROUTE = /^\/files\/([A-Za-z0-9_-]{1,150})\/([A-Za-z0-9_-]{1,150})(\/url)?$/

function allowedOrigin(env: Env, request: Request): string {
  const allowed = (env.FILES_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (allowed.length === 0) return '*'
  const origin = request.headers.get('origin') ?? ''
  return allowed.includes(origin) ? origin : allowed[0] ?? '*'
}

function cors(env: Env, request: Request, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'access-control-allow-origin': allowedOrigin(env, request),
    'access-control-allow-methods': 'GET, HEAD, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-file-name, range',
    'access-control-expose-headers':
      'content-length, content-disposition, content-type, etag, content-range, accept-ranges',
    'access-control-max-age': '86400',
    vary: 'origin',
    ...extra,
  }
}

function text(
  env: Env,
  request: Request,
  message: string,
  status: number,
): Response {
  return new Response(message, {
    status,
    headers: cors(env, request, { 'content-type': 'text/plain; charset=utf-8' }),
  })
}

function json(
  env: Env,
  request: Request,
  body: unknown,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(env, request, { 'content-type': 'application/json; charset=utf-8' }),
  })
}

const memberCache = new Map<string, { member: boolean; expiresAt: number }>()
const MEMBER_CACHE_MS = 30_000

async function authorize(
  env: Env,
  request: Request,
  workspaceId: string,
): Promise<{ uid: string } | Response> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return text(env, request, 'Falta el token de Firebase.', 401)
  const uid = await verifyIdToken(env, token)
  if (!uid) return text(env, request, 'Token inválido o expirado.', 401)
  const key = `${workspaceId}:${uid}`
  const cached = memberCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.member ? { uid } : text(env, request, 'No perteneces a este workspace.', 403)
  }
  try {
    const member = await isWorkspaceMember(env, workspaceId, uid)
    memberCache.set(key, { member, expiresAt: Date.now() + MEMBER_CACHE_MS })
    if (!member) return text(env, request, 'No perteneces a este workspace.', 403)
  } catch (error) {
    console.error('[openqomu-files] membership', error)
    return text(env, request, 'No se pudo comprobar el workspace.', 500)
  }
  return { uid }
}

/** Solo el autor o un admin/owner pueden reemplazar o borrar un objeto existente. */
async function canModifyFile(
  env: Env,
  workspaceId: string,
  fileId: string,
  uid: string,
): Promise<boolean> {
  const owner = await getFileOwner(env, workspaceId, fileId)
  if (owner === null) return true
  if (owner && owner === uid) return true
  const role = await getMemberRole(env, workspaceId, uid)
  return role === 'owner' || role === 'admin'
}

async function handleUpload(
  env: Env,
  request: Request,
  workspaceId: string,
  fileId: string,
): Promise<Response> {
  const auth = await authorize(env, request, workspaceId)
  if (auth instanceof Response) return auth
  try {
    if (!(await canModifyFile(env, workspaceId, fileId, auth.uid))) {
      return text(env, request, 'No tienes permiso para reemplazar este archivo.', 403)
    }
  } catch (error) {
    console.error('[openqomu-files] permissions', error)
    return text(env, request, 'No se pudieron comprobar los permisos.', 500)
  }

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
    return text(env, request, 'El archivo supera el límite de 25 MB.', 413)
  }
  const body = await request.arrayBuffer()
  if (body.byteLength === 0) return text(env, request, 'El archivo está vacío.', 400)
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return text(env, request, 'El archivo supera el límite de 25 MB.', 413)
  }

  const contentType = request.headers.get('content-type') || 'application/octet-stream'
  const rawName = request.headers.get('x-file-name') ?? fileId
  let fileName = fileId
  try {
    fileName = decodeURIComponent(rawName).slice(0, 200)
  } catch {
    // Se queda el id como nombre de reserva.
  }

  try {
    const response = await putObject(env, objectKey(workspaceId, fileId), body, contentType, fileName)
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[openqomu-files] put', response.status, detail.slice(0, 300))
      return text(env, request, 'Backblaze rechazó la subida.', 502)
    }
  } catch (error) {
    console.error('[openqomu-files] put', error)
    return text(env, request, 'No se pudo guardar el archivo.', 502)
  }

  return json(env, request, { ok: true }, 201)
}

async function handleDownload(
  env: Env,
  request: Request,
  workspaceId: string,
  fileId: string,
  method: 'GET' | 'HEAD',
): Promise<Response> {
  const url = new URL(request.url)
  const expiresAt = Number(url.searchParams.get('exp') ?? '0')
  const signature = url.searchParams.get('sig') ?? ''
  const signed =
    Boolean(env.FILE_URL_SECRET) &&
    expiresAt > 0 &&
    signature.length > 0 &&
    (await verifyFileUrl(env.FILE_URL_SECRET, workspaceId, fileId, expiresAt, signature))

  let fileName = ''
  if (!signed) {
    const auth = await authorize(env, request, workspaceId)
    if (auth instanceof Response) return auth
    fileName = url.searchParams.get('name') ?? ''
  }

  let response: Response
  try {
    const range = request.headers.get('range')
    response = await getObject(
      env,
      objectKey(workspaceId, fileId),
      method,
      range ? { range } : {},
    )
  } catch (error) {
    console.error('[openqomu-files] get', error)
    return text(env, request, 'No se pudo leer el archivo.', 502)
  }
  if (response.status === 404) {
    return text(env, request, 'El archivo no existe.', 404)
  }
  if (!response.ok) {
    console.error('[openqomu-files] get', response.status)
    return text(env, request, 'No se pudo leer el archivo.', 502)
  }

  const disposition = fileName
    ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    : response.headers.get('content-disposition') ?? 'inline'
  const headers = cors(env, request, {
    'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
    'content-disposition': disposition,
    'cache-control': signed ? 'private, max-age=300' : 'no-store',
  })
  const length = response.headers.get('content-length')
  if (length) headers['content-length'] = length
  const etag = response.headers.get('etag')
  if (etag) headers.etag = etag
  const contentRange = response.headers.get('content-range')
  if (contentRange) headers['content-range'] = contentRange
  const acceptRanges = response.headers.get('accept-ranges')
  if (acceptRanges) headers['accept-ranges'] = acceptRanges

  return new Response(method === 'HEAD' ? null : response.body, {
    status: response.status,
    headers,
  })
}

async function handleUrl(
  env: Env,
  request: Request,
  workspaceId: string,
  fileId: string,
): Promise<Response> {
  const auth = await authorize(env, request, workspaceId)
  if (auth instanceof Response) return auth
  if (!env.FILE_URL_SECRET) {
    return text(env, request, 'Falta el secreto FILE_URL_SECRET.', 500)
  }
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS
  const signature = await signFileUrl(env.FILE_URL_SECRET, workspaceId, fileId, expiresAt)
  const target = new URL(`/files/${workspaceId}/${fileId}`, request.url)
  target.searchParams.set('exp', String(expiresAt))
  target.searchParams.set('sig', signature)
  return json(
    env,
    request,
    { url: target.toString(), expiresAt: expiresAt * 1000 },
    200,
  )
}

async function handleDelete(
  env: Env,
  request: Request,
  workspaceId: string,
  fileId: string,
): Promise<Response> {
  const auth = await authorize(env, request, workspaceId)
  if (auth instanceof Response) return auth
  try {
    if (!(await canModifyFile(env, workspaceId, fileId, auth.uid))) {
      return text(env, request, 'No tienes permiso para borrar este archivo.', 403)
    }
  } catch (error) {
    console.error('[openqomu-files] permissions', error)
    return text(env, request, 'No se pudieron comprobar los permisos.', 500)
  }
  try {
    const response = await deleteObject(env, objectKey(workspaceId, fileId))
    if (!response.ok && response.status !== 404) {
      console.error('[openqomu-files] delete', response.status)
      return text(env, request, 'No se pudo borrar el archivo.', 502)
    }
  } catch (error) {
    console.error('[openqomu-files] delete', error)
    return text(env, request, 'No se pudo borrar el archivo.', 502)
  }
  return new Response(null, { status: 204, headers: cors(env, request) })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env, request) })
    }

    if (url.pathname === '/health') {
      return json(
        env,
        request,
        { ok: true, s3: Boolean(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) },
        200,
      )
    }

    const match = url.pathname.match(ROUTE)
    if (!match) return text(env, request, 'Not found', 404)

    if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      return text(
        env,
        request,
        'Faltan los secretos S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY en el Worker.',
        503,
      )
    }

    const [, workspaceId, fileId, suffix] = match
    if (!workspaceId || !fileId) return text(env, request, 'Not found', 404)

    if (suffix === '/url') {
      if (request.method !== 'GET') return text(env, request, 'Method not allowed', 405)
      return handleUrl(env, request, workspaceId, fileId)
    }

    switch (request.method) {
      case 'POST':
        return handleUpload(env, request, workspaceId, fileId)
      case 'GET':
      case 'HEAD':
        return handleDownload(env, request, workspaceId, fileId, request.method)
      case 'DELETE':
        return handleDelete(env, request, workspaceId, fileId)
      default:
        return text(env, request, 'Method not allowed', 405)
    }
  },
}
