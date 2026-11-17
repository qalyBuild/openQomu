import { SignJWT, importPKCS8 } from 'jose'
import { decodeFields, encodeFields, encodeValue, type FirestorePrimitive } from './codec'
import type { Env } from './env'

interface FirestoreDocument {
  name?: string
  fields?: Record<string, FirestorePrimitive>
  updateTime?: string
}

export interface StoredDocument<T = Record<string, unknown>> {
  id: string
  data: T
  updateTime?: string
}

const accessTokenCache = new Map<
  string,
  { serviceAccount: string; token: string; expiresAt: number }
>()

function cacheKey(env: Env, scope: string): string {
  return `${env.FIREBASE_SERVICE_ACCOUNT.length}:${scope}`
}

function documentsBase(env: Env): string {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function documentName(env: Env, path: string): string {
  return `${documentsBase(env)}/${encodePath(path)}`
}

function idFromName(name: string | undefined): string {
  if (!name) return ''
  return decodeURIComponent(name.split('/').pop() ?? '')
}

async function getAccessToken(env: Env, scope: string): Promise<string> {
  const key = cacheKey(env, scope)
  const cached = accessTokenCache.get(key)
  if (
    cached &&
    cached.serviceAccount === env.FIREBASE_SERVICE_ACCOUNT &&
    Date.now() < cached.expiresAt - 60_000
  ) {
    return cached.token
  }

  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as {
    client_email: string
    private_key: string
  }
  const signingKey = await importPKCS8(serviceAccount.private_key, 'RS256')
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .setSubject(serviceAccount.client_email)
    .sign(signingKey)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  })
  if (!response.ok) {
    throw new Error(`No se pudo autenticar el service account (${response.status}).`)
  }
  const payload = (await response.json()) as { access_token: string; expires_in: number }
  accessTokenCache.set(key, {
    serviceAccount: env.FIREBASE_SERVICE_ACCOUNT,
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  })
  return payload.access_token
}

async function firestoreFetch(
  env: Env,
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const token = await getAccessToken(env, 'https://www.googleapis.com/auth/datastore')
  const response = await fetch(`${documentsBase(env)}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
  if (response.status === 401 && retry) {
    accessTokenCache.delete(cacheKey(env, 'https://www.googleapis.com/auth/datastore'))
    return firestoreFetch(env, path, init, false)
  }
  return response
}

async function expectOk(response: Response, operation: string): Promise<void> {
  if (response.ok) return
  const text = await response.text()
  throw new Error(`Firestore ${operation} falló (${response.status}): ${text.slice(0, 300)}`)
}

export async function getDocument<T = Record<string, unknown>>(
  env: Env,
  path: string,
): Promise<StoredDocument<T> | null> {
  const response = await firestoreFetch(env, `/${encodePath(path)}`)
  if (response.status === 404) return null
  await expectOk(response, 'get')
  const document = (await response.json()) as FirestoreDocument
  return {
    id: idFromName(document.name),
    data: decodeFields(document.fields) as T,
    updateTime: document.updateTime,
  }
}

export async function listCollection<T = Record<string, unknown>>(
  env: Env,
  parentPath: string,
  collectionId: string,
): Promise<Array<StoredDocument<T>>> {
  const results: Array<StoredDocument<T>> = []
  let pageToken: string | undefined
  do {
    const parent = parentPath ? `/${encodePath(parentPath)}` : ''
    const query = new URLSearchParams({ pageSize: '300' })
    if (pageToken) query.set('pageToken', pageToken)
    const response = await firestoreFetch(
      env,
      `${parent}/${encodeURIComponent(collectionId)}?${query.toString()}`,
    )
    await expectOk(response, 'list')
    const payload = (await response.json()) as {
      documents?: FirestoreDocument[]
      nextPageToken?: string
    }
    for (const document of payload.documents ?? []) {
      results.push({
        id: idFromName(document.name),
        data: decodeFields(document.fields) as T,
        updateTime: document.updateTime,
      })
    }
    pageToken = payload.nextPageToken
  } while (pageToken)
  return results
}

export async function queryEquals<T = Record<string, unknown>>(
  env: Env,
  parentPath: string,
  collectionId: string,
  fieldPath: string,
  value: unknown,
  limit = 20,
): Promise<Array<StoredDocument<T>>> {
  const response = await firestoreFetch(env, '/:runQuery', {
    method: 'POST',
    body: JSON.stringify({
      parent: parentPath ? documentName(env, parentPath) : documentsBase(env),
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: encodeValue(value),
          },
        },
        limit,
      },
    }),
  })
  await expectOk(response, 'query')
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>
  return rows
    .filter((row) => row.document)
    .map((row) => ({
      id: idFromName(row.document?.name),
      data: decodeFields(row.document?.fields) as T,
      updateTime: row.document?.updateTime,
    }))
}

/** Consulta de grupo de colecciones con un único filtro de rango. */
export async function queryCollectionGroup<T = Record<string, unknown>>(
  env: Env,
  collectionId: string,
  fieldPath: string,
  op: 'LESS_THAN' | 'GREATER_THAN',
  value: string,
  limit = 200,
): Promise<Array<StoredDocument<T> & { path: string }>> {
  const response = await firestoreFetch(env, '/:runQuery', {
    method: 'POST',
    body: JSON.stringify({
      parent: documentsBase(env),
      structuredQuery: {
        from: [{ collectionId, allDescendants: true }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op,
            value: encodeValue(value),
          },
        },
        limit,
      },
    }),
  })
  await expectOk(response, 'collection group query')
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>
  return rows
    .filter((row) => row.document)
    .map((row) => ({
      id: idFromName(row.document?.name),
      data: decodeFields(row.document?.fields) as T,
      updateTime: row.document?.updateTime,
      path: pathFromName(env, row.document?.name),
    }))
}

/** Consulta de una colección de nivel raíz con un único filtro de rango. */
export async function queryCollectionRange<T = Record<string, unknown>>(
  env: Env,
  collectionId: string,
  fieldPath: string,
  op: 'LESS_THAN' | 'GREATER_THAN',
  value: unknown,
  limit = 200,
): Promise<Array<StoredDocument<T> & { path: string }>> {
  const response = await firestoreFetch(env, '/:runQuery', {
    method: 'POST',
    body: JSON.stringify({
      parent: documentsBase(env),
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op,
            value: encodeValue(value),
          },
        },
        limit,
      },
    }),
  })
  await expectOk(response, 'query')
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>
  return rows
    .filter((row) => row.document)
    .map((row) => ({
      id: idFromName(row.document?.name),
      data: decodeFields(row.document?.fields) as T,
      updateTime: row.document?.updateTime,
      path: pathFromName(env, row.document?.name),
    }))
}

function pathFromName(env: Env, name: string | undefined): string {
  if (!name) return ''
  const prefix = `${documentsBase(env)}/`
  return name
    .slice(prefix.length)
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')
}

export async function updateDocument(
  env: Env,
  path: string,
  data: Record<string, unknown>,
  preconditionUpdateTime?: string,
): Promise<boolean> {
  const query = new URLSearchParams()
  for (const fieldPath of Object.keys(data)) {
    query.append('updateMask.fieldPaths', fieldPath)
  }
  if (preconditionUpdateTime) {
    query.set('currentDocument.updateTime', preconditionUpdateTime)
  }
  const response = await firestoreFetch(env, `/${encodePath(path)}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(data) }),
  })
  if (response.status === 409) return false
  await expectOk(response, 'update')
  return true
}

export async function deleteDocument(env: Env, path: string): Promise<void> {
  const response = await firestoreFetch(env, `/${encodePath(path)}`, { method: 'DELETE' })
  if (response.status === 404) return
  await expectOk(response, 'delete')
}

/** Canjea el service account por un token con el scope de FCM. */
export async function getMessagingAccessToken(env: Env): Promise<string> {
  return getAccessToken(env, 'https://www.googleapis.com/auth/firebase.messaging')
}
