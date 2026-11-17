import type { Env } from './env'
import { deleteDocument, queryCollectionGroup, queryCollectionRange } from './firestore'

/** Same ventana que en la app: el mensaje eliminado se ve una hora y luego se borra. */
export const DELETED_MESSAGE_TTL_MS = 60 * 60 * 1000

/** Colecciones de invitaciones que no deben sobrevivir a su caducidad. */
export const INVITE_COLLECTIONS = ['accessInvites', 'invites'] as const

interface PurgeDeps {
  listExpired(cutoff: string): Promise<Array<{ path: string }>>
  listExpiredIn(collection: string, cutoffMs: number): Promise<Array<{ path: string }>>
  remove(path: string): Promise<void>
}

function firestoreDeps(env: Env): PurgeDeps {
  return {
    listExpired: (cutoff) =>
      queryCollectionGroup(env, 'messages', 'deletedAt', 'LESS_THAN', cutoff),
    listExpiredIn: (collection, cutoffMs) =>
      queryCollectionRange(env, collection, 'expiresAtMs', 'LESS_THAN', cutoffMs),
    remove: (path) => deleteDocument(env, path),
  }
}

/** Borra definitivamente los mensajes eliminados hace más de una hora. */
export async function purgeDeletedMessages(
  env: Env,
  now: number = Date.now(),
  deps: PurgeDeps = firestoreDeps(env),
): Promise<number> {
  const cutoff = new Date(now - DELETED_MESSAGE_TTL_MS).toISOString()
  const expired = await deps.listExpired(cutoff)
  for (const document of expired) await deps.remove(document.path)
  return expired.length
}

/** Borra invitaciones caducadas: sin esto, un enlace viejo sigue existiendo. */
export async function purgeExpiredInvites(
  env: Env,
  now: number = Date.now(),
  deps: PurgeDeps = firestoreDeps(env),
): Promise<number> {
  let total = 0
  for (const collection of INVITE_COLLECTIONS) {
    const expired = await deps.listExpiredIn(collection, now)
    for (const document of expired) await deps.remove(document.path)
    total += expired.length
  }
  return total
}
