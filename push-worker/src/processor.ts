import type { FcmSender, OutboxEvent, Store } from './domain'
import { resolveNotification } from './domain'
import { supportsGroupedNotifications } from './fcm'

export const MAX_ATTEMPTS = 5
export const STALE_CLAIM_MS = 2 * 60 * 1000
// El plan gratuito de Workers limita a 50 subrequests por invocación.
// Cada evento gasta ~8-10 (Firestore, dispositivos, FCM), así que el cron
// procesa 3 por minuto para no agotar el límite.
export const MAX_BATCH = 3

export type ProcessResult = 'processed' | 'empty' | 'skipped' | 'missing' | 'failed'

function isStale(event: OutboxEvent, now: number): boolean {
  if (!event.claimedAt) return true
  const claimed = Date.parse(event.claimedAt)
  return Number.isNaN(claimed) || now - claimed > STALE_CLAIM_MS
}

/** Procesa un evento del outbox de forma idempotente. */
export async function processEvent(
  store: Store,
  fcm: FcmSender,
  eventId: string,
  now = Date.now(),
): Promise<ProcessResult> {
  const event = await store.getEvent(eventId)
  if (!event) return 'missing'
  if (event.status === 'processed' || event.status === 'failed') return 'skipped'
  if (event.status === 'processing' && !isStale(event, now)) return 'skipped'
  if (event.attempts >= MAX_ATTEMPTS) {
    await store.recordFailure(event, 'Demasiados intentos.')
    return 'failed'
  }

  const claimed = await store.claim(event)
  if (!claimed) return 'skipped'

  try {
    const resolved = await resolveNotification(store, event)
    if (!resolved || resolved.recipients.length === 0) {
      await store.markProcessed(event)
      return 'empty'
    }

    const devices = (
      await Promise.all(resolved.recipients.map((uid) => store.listDevices(uid)))
    ).flat()
    const active = devices.filter((device) => device.enabled && device.token)
    const modern = active.filter((device) => supportsGroupedNotifications(device.appVersion))
    const legacy = active.filter((device) => !supportsGroupedNotifications(device.appVersion))

    const deliveries: Array<{ delivered: number; invalidTokens: string[] }> = []
    if (modern.length > 0) {
      deliveries.push(
        await fcm.send(
          [...new Set(modern.map((device) => device.token))],
          resolved.content,
        ),
      )
    }
    // Las APK anteriores a la 1.0.10 no saben construir el historial: siguen
    // recibiendo el payload con notificación para no quedarse sin avisos.
    if (legacy.length > 0) {
      deliveries.push(
        await fcm.send(
          [...new Set(legacy.map((device) => device.token))],
          resolved.content,
          true,
        ),
      )
    }

    const invalidTokens = new Set(deliveries.flatMap((result) => result.invalidTokens))
    if (invalidTokens.size > 0) {
      for (const device of devices) {
        if (invalidTokens.has(device.token)) {
          await store.deleteDevice(device.uid, device.id).catch(() => {})
        }
      }
    }

    await store.markProcessed(event)
    return 'processed'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.'
    await store.recordFailure(event, message)
    return 'failed'
  }
}

export async function processPending(
  store: Store,
  fcm: FcmSender,
  limit = MAX_BATCH,
  now = Date.now(),
): Promise<Record<ProcessResult, number>> {
  const counts: Record<ProcessResult, number> = {
    processed: 0,
    empty: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
  }
  const [pending, processing] = await Promise.all([
    store.listByStatus('pending', limit),
    store.listByStatus('processing', limit),
  ])
  const stale = processing.filter((event) => isStale(event, now))
  for (const event of [...pending, ...stale]) {
    const result = await processEvent(store, fcm, event.id, now)
    counts[result] += 1
  }
  return counts
}
