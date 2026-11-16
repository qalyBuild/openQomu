import { SignJWT, importPKCS8 } from 'jose'
import { decodeFields, encodeFields, encodeValue, type FirestorePrimitive } from './codec'
import type { Env } from './env'

interface FirestoreDocument {
  name?: string
  fields?: Record<string, FirestorePrimitive>
}

export interface StoredDocument<T = Record<string, unknown>> {
  id: string
  data: T
}

export interface FirestoreWrite {
  path: string
  data: Record<string, unknown>
  fieldPaths: string[]
}

export interface FirestoreDelete {
  path: string
}

let accessTokenCache:
  | { serviceAccount: string; token: string; expiresAt: number }
  | null = null

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

function documentResource(env: Env, path: string): string {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${encodePath(path)}`
}

function documentName(env: Env, path: string): string {
  return `${documentsBase(env)}/${encodePath(path)}`
}

function idFromName(name: string | undefined): string {
  if (!name) return ''
  return decodeURIComponent(name.split('/').pop() ?? '')
}

async function getAccessToken(env: Env): Promise<string> {
  if (
    accessTokenCache &&
    accessTokenCache.serviceAccount === env.FIREBASE_SERVICE_ACCOUNT &&
    Date.now() < accessTokenCache.expiresAt - 60_000
  ) {
    return accessTokenCache.token
  }

  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as {
    client_email: string
    private_key: string
  }
  const key = await importPKCS8(serviceAccount.private_key, 'RS256')
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .setSubject(serviceAccount.client_email)
    .sign(key)

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
  accessTokenCache = {
    serviceAccount: env.FIREBASE_SERVICE_ACCOUNT,
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  }
  return payload.access_token
}

async function firestoreFetch(
  env: Env,
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const token = await getAccessToken(env)
  const response = await fetch(`${documentsBase(env)}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
  if (response.status === 401 && retry) {
    accessTokenCache = null
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
      })
    }
    pageToken = payload.nextPageToken
  } while (pageToken)
  return results
}

export async function queryCollection<T = Record<string, unknown>>(
  env: Env,
  parentPath: string,
  collectionId: string,
  fieldPath: string,
  value: unknown,
  limit = 100,
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
            op: 'ARRAY_CONTAINS',
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
    }))
}

export async function createDocument(
  env: Env,
  parentPath: string,
  collectionId: string,
  id: string,
  data: Record<string, unknown>,
): Promise<StoredDocument> {
  const parent = parentPath ? `/${encodePath(parentPath)}` : ''
  const response = await firestoreFetch(
    env,
    `${parent}/${encodeURIComponent(collectionId)}?documentId=${encodeURIComponent(id)}`,
    {
      method: 'POST',
      body: JSON.stringify({ fields: encodeFields(data) }),
    },
  )
  await expectOk(response, 'create')
  return { id, data }
}

export async function updateDocument(
  env: Env,
  path: string,
  data: Record<string, unknown>,
): Promise<void> {
  const fieldPaths = Object.keys(data)
  const query = new URLSearchParams()
  for (const fieldPath of fieldPaths) query.append('updateMask.fieldPaths', fieldPath)
  const response = await firestoreFetch(env, `/${encodePath(path)}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(data) }),
  })
  await expectOk(response, 'update')
}

export async function deleteDocument(env: Env, path: string): Promise<void> {
  const response = await firestoreFetch(env, `/${encodePath(path)}`, { method: 'DELETE' })
  await expectOk(response, 'delete')
}

export async function commitWrites(
  env: Env,
  updates: FirestoreWrite[],
  deletes: FirestoreDelete[] = [],
): Promise<void> {
  const writes = [
    ...updates.map((update) => ({
      update: {
        name: documentResource(env, update.path),
        fields: encodeFields(update.data),
      },
      updateMask: { fieldPaths: update.fieldPaths },
    })),
    ...deletes.map((deletion) => ({ delete: documentResource(env, deletion.path) })),
  ]
  if (writes.length === 0) return
  const response = await firestoreFetch(env, '/:commit', {
    method: 'POST',
    body: JSON.stringify({ writes }),
  })
  await expectOk(response, 'commit')
}
