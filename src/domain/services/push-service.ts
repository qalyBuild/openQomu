import { ValidationError } from '@/domain/errors'
import {
  DEVICE_PLATFORMS,
  NOTIFIABLE_TASK_FIELDS,
  PUSH_EVENT_KINDS,
  type DevicePlatform,
  type PushEvent,
  type PushEventInput,
  type RegisterDeviceInput,
} from '@/domain/entities/push'

const TOKEN_MIN_LENGTH = 20
const TOKEN_MAX_LENGTH = 4096
const APP_VERSION_MAX_LENGTH = 40

export function isDevicePlatform(value: unknown): value is DevicePlatform {
  return typeof value === 'string' && (DEVICE_PLATFORMS as readonly string[]).includes(value)
}

export function validateDeviceToken(token: string): string {
  const trimmed = token.trim()
  if (trimmed.length < TOKEN_MIN_LENGTH) {
    throw new ValidationError('El token del dispositivo no es válido.')
  }
  if (trimmed.length > TOKEN_MAX_LENGTH) {
    throw new ValidationError('El token del dispositivo es demasiado largo.')
  }
  return trimmed
}

export function normalizeAppVersion(appVersion: string | null | undefined): string | null {
  const trimmed = appVersion?.trim() ?? ''
  if (!trimmed) return null
  return trimmed.slice(0, APP_VERSION_MAX_LENGTH)
}

export function createDeviceRegistration(input: RegisterDeviceInput): RegisterDeviceInput {
  const id = input.id.trim()
  if (!id) throw new ValidationError('Falta el identificador del dispositivo.')
  if (!isDevicePlatform(input.platform)) {
    throw new ValidationError('La plataforma del dispositivo no es válida.')
  }
  return {
    id,
    token: validateDeviceToken(input.token),
    platform: input.platform,
    appVersion: normalizeAppVersion(input.appVersion),
  }
}

export function isPushEventKind(value: unknown): boolean {
  return typeof value === 'string' && (PUSH_EVENT_KINDS as readonly string[]).includes(value)
}

function required(value: string | null | undefined, message: string): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) throw new ValidationError(message)
  return trimmed
}

function optional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

/** Valida y normaliza un evento antes de escribirlo en el outbox. */
export function createPushEvent(input: PushEventInput): PushEvent {
  if (!isPushEventKind(input.kind)) {
    throw new ValidationError('El tipo de notificación no es válido.')
  }
  const workspaceId = required(input.workspaceId, 'Falta el espacio de la notificación.')
  const actorId = required(input.actorId, 'Falta el autor de la notificación.')
  const event: PushEvent = {
    kind: input.kind,
    workspaceId,
    actorId,
    createdAt: input.now ?? new Date().toISOString(),
    channelId: optional(input.channelId),
    boardId: optional(input.boardId),
    taskId: optional(input.taskId),
    messageId: optional(input.messageId),
    commentId: optional(input.commentId),
  }

  if (event.kind === 'message.created') {
    event.channelId = required(event.channelId, 'Falta el canal del mensaje.')
    event.messageId = required(event.messageId, 'Falta el mensaje que notificar.')
  } else {
    event.boardId = required(event.boardId, 'Falta el tablero de la tarea.')
    event.taskId = required(event.taskId, 'Falta la tarea que notificar.')
    if (event.kind === 'task.comment') {
      event.commentId = required(event.commentId, 'Falta el comentario que notificar.')
    }
    if (event.kind === 'task.updated') {
      const changed = new Set(input.changedFields ?? [])
      event.changedFields = NOTIFIABLE_TASK_FIELDS.filter((field) => changed.has(field))
    }
  }

  return event
}

/** Un cambio de tarea solo genera push si toca responsables o revisión. */
export function isNotifiableTaskUpdate(event: PushEvent): boolean {
  return (
    event.kind === 'task.updated' &&
    (event.changedFields ?? []).some((field) =>
      (NOTIFIABLE_TASK_FIELDS as readonly string[]).includes(field),
    )
  )
}

/** Deduplica y excluye al autor de la lista de destinatarios. */
export function recipientsFor(actorId: string, candidates: Array<string | null | undefined>): string[] {
  return [...new Set(candidates.filter((uid): uid is string => Boolean(uid?.trim())))].filter(
    (uid) => uid !== actorId,
  )
}
