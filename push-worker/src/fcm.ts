import type { Env } from './env'
import type { FcmSender, NotificationContent } from './domain'
import { getMessagingAccessToken } from './firestore'

export interface FcmDataMessage {
  message: {
    token: string
    data: {
      id: string
      title: string
      body: string
      path: string
      groupKey: string
    }
    android: {
      priority: 'high'
    }
  }
}

export interface FcmLegacyMessage {
  message: {
    token: string
    notification: { title: string; body: string }
    data: { path: string }
    android: {
      priority: 'high'
      collapse_key: string
      notification: {
        channel_id: string
        sound: string
        tag: string
        default_vibrate_timings: boolean
      }
    }
  }
}

export type FcmMessage = FcmDataMessage | FcmLegacyMessage

export const NOTIFICATION_CHANNEL_ID = 'openqomu-v2'
export const NOTIFICATION_SOUND = 'openqomu_notification'

/**
 * Agrupa avisos del mismo origen: un chat o un tablero. El APK usa esta clave
 * para mantener el historial de cada grupo en una sola notificación.
 */
export function notificationGroupKey(path: string): string {
  const chat = path.match(/\/c\/([^/?#]+)/)
  if (chat) return `chat-${chat[1]}`
  const board = path.match(/\/boards\/([^/?#]+)/)
  if (board) return `board-${board[1]}`
  return 'openqomu'
}

/** La 1.0.10 es la primera APK que construye las notificaciones agrupadas. */
export function supportsGroupedNotifications(version: string | null | undefined): boolean {
  if (!version) return false
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return false
  const [major, minor, patch] = match.slice(1).map(Number)
  return major > 1 || (major === 1 && (minor > 0 || patch >= 10))
}

/**
 * Envía solo datos: la notificación la construye el APK para poder mostrar el
 * historial de mensajes de cada chat o tablero. Si se enviara el bloque
 * `notification`, Android la mostraría por su cuenta y se perdería el historial.
 */
export function buildFcmMessage(token: string, content: NotificationContent): FcmDataMessage {
  return {
    message: {
      token,
      data: {
        id: content.id,
        title: content.title,
        body: content.body,
        path: content.path,
        groupKey: notificationGroupKey(content.path),
      },
      android: {
        priority: 'high',
      },
    },
  }
}

/** Payload antiguo para APK anteriores a la 1.0.10. */
export function buildLegacyFcmMessage(
  token: string,
  content: NotificationContent,
): FcmLegacyMessage {
  const groupKey = notificationGroupKey(content.path)
  return {
    message: {
      token,
      notification: { title: content.title, body: content.body },
      data: { path: content.path },
      android: {
        priority: 'high',
        collapse_key: groupKey,
        notification: {
          channel_id: NOTIFICATION_CHANNEL_ID,
          sound: NOTIFICATION_SOUND,
          tag: groupKey,
          default_vibrate_timings: true,
        },
      },
    },
  }
}

function isInvalidToken(status: number, body: string): boolean {
  return (
    status === 404 ||
    body.includes('UNREGISTERED') ||
    body.includes('INVALID_ARGUMENT') ||
    body.includes('registration-token-not-registered')
  )
}

export class FirebaseFcmSender implements FcmSender {
  private readonly env: Env
  private readonly tokenProvider: () => Promise<string>

  constructor(env: Env, tokenProvider: () => Promise<string> = () => getMessagingAccessToken(env)) {
    this.env = env
    this.tokenProvider = tokenProvider
  }

  async send(
    tokens: string[],
    content: NotificationContent,
    legacy = false,
  ): Promise<{ delivered: number; invalidTokens: string[] }> {
    const accessToken = await this.tokenProvider()
    const projectId = this.env.FCM_PROJECT_ID ?? this.env.FIREBASE_PROJECT_ID
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
    const invalidTokens: string[] = []
    const errors: string[] = []
    let delivered = 0

    for (let index = 0; index < tokens.length; index += 20) {
      const batch = tokens.slice(index, index + 20)
      const results = await Promise.all(
        batch.map(async (token) => {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                authorization: `Bearer ${accessToken}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify(
                legacy ? buildLegacyFcmMessage(token, content) : buildFcmMessage(token, content),
              ),
            })
            if (response.ok) return { token, ok: true, invalid: false, error: null }
            const body = await response.text()
            return {
              token,
              ok: false,
              invalid: isInvalidToken(response.status, body),
              error: `${response.status}: ${body.slice(0, 160)}`,
            }
          } catch (error) {
            console.warn('[openqomu-push] FCM', error)
            return {
              token,
              ok: false,
              invalid: false,
              error: error instanceof Error ? error.message : 'Error de red',
            }
          }
        }),
      )
      for (const result of results) {
        if (result.ok) delivered += 1
        else if (result.invalid) invalidTokens.push(result.token)
        else if (result.error) errors.push(result.error)
      }
    }

    if (delivered === 0 && errors.length > 0) {
      throw new Error(`FCM falló: ${errors[0]}`)
    }
    if (errors.length > 0) {
      console.warn('[openqomu-push] entregas parciales fallidas', errors[0])
    }
    return { delivered, invalidTokens }
  }
}
