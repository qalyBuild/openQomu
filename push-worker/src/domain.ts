export const EVENT_KINDS = [
  'message.created',
  'task.created',
  'task.updated',
  'task.comment',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export type EventStatus = 'pending' | 'processing' | 'processed' | 'failed'

export interface OutboxEvent {
  id: string
  kind: EventKind
  workspaceId: string
  actorId: string
  createdBy: string
  channelId: string | null
  boardId: string | null
  taskId: string | null
  messageId: string | null
  commentId: string | null
  changedFields: string[]
  createdAt: string
  status: EventStatus
  attempts: number
  claimedAt?: string | null
  processedAt?: string | null
  lastError?: string | null
  updateTime?: string
}

export interface MessageRecord {
  id: string
  authorId: string
  authorName: string
  body: string
  attachmentIds: string[]
  deletedAt?: string | null
}

export interface CommentRecord {
  id: string
  authorId: string
  authorName: string
  body: string
}

export interface ChannelRecord {
  id: string
  name: string
  type: 'public' | 'private'
  memberIds: string[]
}

export interface WorkspaceRecord {
  id: string
  name: string
  memberIds: string[]
}

export interface TaskRecord {
  id: string
  title: string
  assigneeIds: string[]
  reviewerId: string | null
  createdBy: string
}

export interface DeviceRecord {
  id: string
  uid: string
  token: string
  enabled: boolean
  appVersion: string | null
}

export interface NotificationContent {
  /** Identificador del evento: permite deduplicar el aviso en el dispositivo. */
  id: string
  title: string
  body: string
  path: string
}

export interface Store {
  getEvent(id: string): Promise<OutboxEvent | null>
  listByStatus(status: EventStatus, limit: number): Promise<OutboxEvent[]>
  claim(event: OutboxEvent): Promise<boolean>
  markProcessed(event: OutboxEvent): Promise<void>
  recordFailure(event: OutboxEvent, message: string): Promise<void>
  getMessage(workspaceId: string, channelId: string, messageId: string): Promise<MessageRecord | null>
  getComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
  ): Promise<CommentRecord | null>
  getChannel(workspaceId: string, channelId: string): Promise<ChannelRecord | null>
  getWorkspace(workspaceId: string): Promise<WorkspaceRecord | null>
  getBoard(workspaceId: string, boardId: string): Promise<{ status?: string } | null>
  getTask(workspaceId: string, boardId: string, taskId: string): Promise<TaskRecord | null>
  listDevices(uid: string): Promise<DeviceRecord[]>
  deleteDevice(uid: string, deviceId: string): Promise<void>
}

export interface FcmSender {
  send(
    tokens: string[],
    content: NotificationContent,
    legacy?: boolean,
  ): Promise<{ delivered: number; invalidTokens: string[] }>
}

const NOTIFIABLE_TASK_FIELDS = ['assigneeIds', 'reviewerId']
const MAX_BODY = 140

export function excerpt(value: string, max = MAX_BODY): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max - 1).trimEnd()}…`
}

export function isNotifiableUpdate(event: Pick<OutboxEvent, 'kind' | 'changedFields'>): boolean {
  if (event.kind !== 'task.updated') return true
  return event.changedFields.some((field) => NOTIFIABLE_TASK_FIELDS.includes(field))
}

function dedupe(actorId: string, candidates: string[]): string[] {
  return [...new Set(candidates.filter((uid) => uid && uid !== actorId))]
}

export interface ResolvedNotification {
  recipients: string[]
  content: NotificationContent
}

/**
 * Resuelve destinatarios y contenido a partir de los datos actuales.
 * Devuelve null si el evento ya no es notificable (documento borrado, etc.).
 */
export async function resolveNotification(
  store: Store,
  event: OutboxEvent,
): Promise<ResolvedNotification | null> {
  if (!isNotifiableUpdate(event)) return null

  if (event.kind === 'message.created') {
    if (!event.channelId || !event.messageId) return null
    const [message, channel, workspace] = await Promise.all([
      store.getMessage(event.workspaceId, event.channelId, event.messageId),
      store.getChannel(event.workspaceId, event.channelId),
      store.getWorkspace(event.workspaceId),
    ])
    if (!message || !channel || message.deletedAt) return null
    const members =
      channel.type === 'private'
        ? channel.memberIds
        : (workspace?.memberIds ?? channel.memberIds)
    return {
      recipients: dedupe(event.actorId, members),
      content: {
        id: event.id,
        title: `${message.authorName || 'Alguien'} en #${channel.name}`,
        body: message.body.trim()
          ? excerpt(message.body)
          : message.attachmentIds.length > 0
            ? 'Envió un archivo adjunto'
            : 'Nuevo mensaje',
        path: `/w/${event.workspaceId}/c/${event.channelId}`,
      },
    }
  }

  if (!event.boardId || !event.taskId) return null
  const [board, task] = await Promise.all([
    store.getBoard(event.workspaceId, event.boardId),
    store.getTask(event.workspaceId, event.boardId, event.taskId),
  ])
  if (!board || !task || board.status === 'paused' || board.status === 'deprecated') return null
  const recipients = dedupe(event.actorId, [...task.assigneeIds, task.reviewerId ?? ''])
  const path = `/w/${event.workspaceId}/boards/${event.boardId}?task=${event.taskId}`

  if (event.kind === 'task.comment' && event.commentId) {
    const comment = await store.getComment(
      event.workspaceId,
      event.boardId,
      event.taskId,
      event.commentId,
    )
    return {
      recipients,
      content: {
        id: event.id,
        title: `${comment?.authorName ?? 'Alguien'} comentó en «${excerpt(task.title, 60)}»`,
        body: comment?.body ? excerpt(comment.body) : 'Nuevo comentario',
        path,
      },
    }
  }

  if (event.kind === 'task.updated') {
    if (event.changedFields.includes('reviewerId') && task.reviewerId) {
      return {
        recipients: dedupe(event.actorId, [task.reviewerId]),
        content: {
          id: event.id,
          title: 'Revisión solicitada',
          body: excerpt(task.title),
          path,
        },
      }
    }
    return {
      recipients,
      content: {
        id: event.id,
        title: 'Cambio de responsables',
        body: excerpt(task.title),
        path,
      },
    }
  }

  return {
    recipients,
    content: {
      id: event.id,
      title: 'Nueva tarea asignada',
      body: excerpt(task.title),
      path,
    },
  }
}
