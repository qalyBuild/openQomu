import type { Env } from './env'
import { getStorageAccessToken } from './firestore'

function bucketFromUrl(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/\/v0\/b\/([^/]+)\/o\//)
  return match ? decodeURIComponent(match[1]) : null
}

export function resolveStorageBucket(env: Env, url: string | null): string | null {
  return env.FIREBASE_STORAGE_BUCKET?.trim() || bucketFromUrl(url)
}

/**
 * Borra un objeto de Firebase Storage con la cuenta de servicio del Worker.
 * No falla si el objeto ya no existe.
 */
export async function deleteStorageObject(
  env: Env,
  objectPath: string,
  url: string | null,
): Promise<void> {
  const bucket = resolveStorageBucket(env, url)
  if (!bucket) {
    throw new Error('Falta FIREBASE_STORAGE_BUCKET o una URL con el bucket de Storage.')
  }
  const token = await getStorageAccessToken(env)
  const encoded = `${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}`
  const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${encoded}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok && response.status !== 404) {
    const text = await response.text()
    throw new Error(
      `Storage delete falló (${response.status}): ${text.slice(0, 300)}`,
    )
  }
}
