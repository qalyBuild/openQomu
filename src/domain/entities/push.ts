/** Entidades y contratos del dominio para notificaciones push. */

export const DEVICE_PLATFORMS = ['android', 'ios'] as const
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number]

export const PUSH_EVENT_KINDS = [
  'message.created',
  'task.created',
  'task.updated',
  'task.comment',
] as const
export type PushEventKind = (typeof PUSH_EVENT_KINDS)[number]

/** Campos de una tarea cuyo cambio justifica una notificación. */
export const NOTIFIABLE_TASK_FIELDS = ['assigneeIds', 'reviewerId'] as const

export interface PushDevice {
  id: string
  uid: string
  token: string
  platform: DevicePlatform
  appVersion: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface RegisterDeviceInput {
  id: string
  token: string
  platform: DevicePlatform
  appVersion?: string | null
}

export interface PushEvent {
  id?: string
  kind: PushEventKind
  workspaceId: string
  actorId: string
  createdAt: string
  channelId?: string | null
  boardId?: string | null
  taskId?: string | null
  messageId?: string | null
  commentId?: string | null
  /** Campos modificados; el Worker decide si merece notificación. */
  changedFields?: string[]
}

export interface PushEventInput {
  kind: PushEventKind
  workspaceId: string
  actorId: string
  channelId?: string | null
  boardId?: string | null
  taskId?: string | null
  messageId?: string | null
  commentId?: string | null
  changedFields?: string[]
  now?: string
}

/** Texto que verá el usuario en la notificación del sistema. */
export interface PushNotificationContent {
  title: string
  body: string
  path: string
}
