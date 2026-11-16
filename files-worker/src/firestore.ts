import { SignJWT, importPKCS8 } from 'jose'
import type { Env } from './env'

interface FirestoreValue {
  stringValue?: string
  arrayValue?: { values?: FirestoreValue[] }
}

interface FirestoreDocument {
  fields?: Record<string, FirestoreValue>
}

let accessTokenCache:
  | { serviceAccount: string; token: string; expiresAt: number }
  | null = null

function documentsBase(env: Env): string {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
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

function readStringArray(value: FirestoreValue | undefined): string[] {
  return (value?.arrayValue?.values ?? [])
    .map((item) => item.stringValue)
    .filter((item): item is string => typeof item === 'string')
}

async function fetchFields(
  env: Env,
  path: string,
): Promise<Record<string, FirestoreValue> | null> {
  const token = await getAccessToken(env)
  const encoded = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const response = await fetch(`${documentsBase(env)}/${encoded}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Firestore respondió ${response.status} al leer ${path}.`)
  }
  const document = (await response.json()) as FirestoreDocument
  return document.fields ?? {}
}

/**
 * Comprueba si el usuario pertenece al workspace leyendo `memberIds` con el
 * service account (las reglas de Firestore no aplican a esta lectura).
 */
export async function isWorkspaceMember(
  env: Env,
  workspaceId: string,
  uid: string,
): Promise<boolean> {
  const fields = await fetchFields(env, `workspaces/${workspaceId}`)
  if (!fields) return false
  return readStringArray(fields.memberIds).includes(uid)
}

/** UID que subió el archivo, o null si el metadato todavía no existe. */
export async function getFileOwner(
  env: Env,
  workspaceId: string,
  fileId: string,
): Promise<string | null> {
  const fields = await fetchFields(env, `workspaces/${workspaceId}/files/${fileId}`)
  if (!fields) return null
  return fields.uploadedBy?.stringValue ?? ''
}

/** Rol del usuario en el workspace (`owner`, `admin`, `member`) o null. */
export async function getMemberRole(
  env: Env,
  workspaceId: string,
  uid: string,
): Promise<string | null> {
  const fields = await fetchFields(env, `workspaces/${workspaceId}/members/${uid}`)
  if (!fields) return null
  return fields.role?.stringValue ?? null
}
