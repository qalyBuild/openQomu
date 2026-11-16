import type { Channel, FileMeta, Message } from '@/domain/entities/chat'
import type { BoardColumn, Task, TaskComment } from '@/domain/entities/kanban'
import { isDependentsColumn, isReviewColumn } from '@/domain/entities/kanban'
import type { Member } from '@/domain/entities/identity'
import type { Page } from '@/domain/entities/pages'
import { isOverdue } from '@/lib/date'
import { mentionsName } from './message-service'

export const NOTIFICATION_SECTIONS = ['chat', 'boards', 'pages', 'files', 'members'] as const

export type NotificationSection = (typeof NOTIFICATION_SECTIONS)[number]

export type NotificationKind =
  | 'message'
  | 'mention'
  | 'assigned'
  | 'review'
  | 'overdue'
  | 'comment'
  | 'page'
  | 'file'
  | 'member'

export interface NotificationItem {
  /** Identidad estable del aviso; cambia cuando llega uno nuevo. */
  id: string
  kind: NotificationKind
  section: NotificationSection
  /** Canal, tablero, página, archivo o miembro al que apunta. */
  targetId: string
  title: string
  /** Número de elementos que representa el aviso. */
  count: number
  createdAt: string | null
  /** Ruta relativa al espacio, sin `/w/:workspaceId`. */
  to: string
}

export interface NotificationSummary {
  items: NotificationItem[]
  byTarget: Record<string, number>
  bySection: Record<NotificationSection, number>
  total: number
}

export function notificationKey(section: NotificationSection, targetId: string): string {
  return `${section}:${targetId}`
}

function emptySections(): Record<NotificationSection, number> {
  return { chat: 0, boards: 0, pages: 0, files: 0, members: 0 }
}

function isAfter(value: string, threshold: string | undefined | null): boolean {
  if (!threshold) return true
  const timestamp = Date.parse(value)
  const limit = Date.parse(threshold)
  if (Number.isNaN(timestamp)) return false
  if (Number.isNaN(limit)) return true
  return timestamp > limit
}

function newest<T extends { createdAt: string }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)
}

function mentionsUser(body: string, displayName: string | null | undefined): boolean {
  return mentionsName(body, displayName)
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export interface MessageNotificationInput {
  channels: Array<Pick<Channel, 'id' | 'name'>>
  messagesByChannel: Record<string, Message[]>
  lastReadByChannel: Record<string, string | undefined>
  uid: string
  displayName?: string | null
}

/**
 * Un aviso por canal con mensajes ajenos y no borrados posteriores a la
 * última lectura. El id incluye el mensaje más reciente para que un mensaje
 * nuevo vuelva a considerarse un aviso distinto.
 */
export function collectMessageNotifications(input: MessageNotificationInput): NotificationItem[] {
  const items: NotificationItem[] = []
  for (const channel of input.channels) {
    const unread = (input.messagesByChannel[channel.id] ?? []).filter(
      (message) =>
        message.authorId !== input.uid &&
        !message.deletedAt &&
        isAfter(message.createdAt, input.lastReadByChannel[channel.id]),
    )
    const latest = newest(unread)
    if (!latest) continue
    const mentioned = unread.some((message) => mentionsUser(message.body, input.displayName))
    items.push({
      id: `message:${channel.id}:${latest.id}`,
      kind: mentioned ? 'mention' : 'message',
      section: 'chat',
      targetId: channel.id,
      title: `${plural(unread.length, 'mensaje nuevo', 'mensajes nuevos')} en #${channel.name}`,
      count: unread.length,
      createdAt: latest.createdAt,
      to: `/c/${channel.id}`,
    })
  }
  return items
}

function isTaskCompleted(task: Task, columns: BoardColumn[]): boolean {
  if (task.completedAt) return true
  return columns.find((column) => column.id === task.columnId)?.isDone === true
}

export interface TaskNotificationInput {
  tasks: Task[]
  columnsByBoard: Record<string, BoardColumn[]>
  uid: string
  now?: Date
}

/**
 * Una tarea solo genera un aviso: revisión, vencida o asignada, en ese orden
 * de prioridad. Las tareas hechas, las pausadas y las de la columna
 * Dependientes no requieren atención.
 */
export function collectTaskNotifications(input: TaskNotificationInput): NotificationItem[] {
  const items: NotificationItem[] = []
  const now = input.now ?? new Date()
  for (const task of input.tasks) {
    if (task.priority === 'paused') continue
    const columns = input.columnsByBoard[task.boardId] ?? []
    const column = columns.find((candidate) => candidate.id === task.columnId)
    if (column && isDependentsColumn(column)) continue
    if (isTaskCompleted(task, columns)) continue

    let kind: NotificationKind | null = null
    let title = ''
    if (column && isReviewColumn(column)) {
      // En revisión solo avisa al responsable de revisión. Los responsables
      // de la tarea no deben recibir avisos por tareas que esperan a otra persona.
      if (task.reviewerId !== input.uid) continue
      kind = 'review'
      title = `Revisar: ${task.title}`
    } else if (task.assigneeIds.includes(input.uid)) {
      if (isOverdue(task.dueDate, now)) {
        kind = 'overdue'
        title = `Vencida: ${task.title}`
      } else {
        kind = 'assigned'
        title = `Asignada: ${task.title}`
      }
    }
    if (!kind) continue

    items.push({
      id: `task:${task.id}:${kind}`,
      kind,
      section: 'boards',
      targetId: task.boardId,
      title,
      count: 1,
      createdAt: task.updatedAt,
      to: `/boards/${task.boardId}?task=${task.id}`,
    })
  }
  return items
}

export interface CommentNotificationInput {
  /** Tareas asignadas a mí sobre las que se quieren contar comentarios. */
  tasks: Task[]
  commentsByTask: Record<string, TaskComment[]>
  lastReadAt: string | undefined | null
  uid: string
  displayName?: string | null
}

export function collectCommentNotifications(input: CommentNotificationInput): NotificationItem[] {
  const items: NotificationItem[] = []
  for (const task of input.tasks) {
    if (!task.assigneeIds.includes(input.uid)) continue
    const fresh = (input.commentsByTask[task.id] ?? []).filter(
      (comment) =>
        comment.authorId !== input.uid && isAfter(comment.createdAt, input.lastReadAt),
    )
    const latest = newest(fresh)
    if (!latest) continue
    const mentioned = fresh.some((comment) => mentionsUser(comment.body, input.displayName))
    items.push({
      id: `comment:${task.id}:${latest.id}`,
      kind: mentioned ? 'mention' : 'comment',
      section: 'boards',
      targetId: task.boardId,
      title: `${plural(fresh.length, 'comentario nuevo', 'comentarios nuevos')} en “${task.title}”`,
      count: fresh.length,
      createdAt: latest.createdAt,
      to: `/boards/${task.boardId}?task=${task.id}`,
    })
  }
  return items
}

export interface ActivityNotificationInput {
  pages: Page[]
  files: FileMeta[]
  members: Member[]
  uid: string
  lastReadAt: Record<string, string | undefined>
}

/** Agrupa páginas, archivos y miembros nuevos por sección. */
export function collectActivityNotifications(
  input: ActivityNotificationInput,
): NotificationItem[] {
  const items: NotificationItem[] = []

  const newPages = input.pages.filter(
    (page) =>
      !page.archived &&
      page.createdBy !== input.uid &&
      isAfter(page.createdAt, input.lastReadAt.pages),
  )
  const latestPage = newest(newPages)
  if (latestPage) {
    items.push({
      id: `page:${latestPage.id}`,
      kind: 'page',
      section: 'pages',
      targetId: 'all',
      title: plural(newPages.length, 'página nueva', 'páginas nuevas'),
      count: newPages.length,
      createdAt: latestPage.createdAt,
      to: '/pages',
    })
  }

  const newFiles = input.files.filter(
    (file) =>
      !file.trashedAt &&
      file.uploadedBy !== input.uid &&
      isAfter(file.createdAt, input.lastReadAt.files),
  )
  const latestFile = newest(newFiles)
  if (latestFile) {
    items.push({
      id: `file:${latestFile.id}`,
      kind: 'file',
      section: 'files',
      targetId: 'all',
      title: plural(newFiles.length, 'archivo nuevo', 'archivos nuevos'),
      count: newFiles.length,
      createdAt: latestFile.createdAt,
      to: '/files',
    })
  }

  const newMembers = input.members.filter(
    (member) =>
      member.uid !== input.uid &&
      isAfter(member.joinedAt, input.lastReadAt.members),
  )
  const latestMember = newest(
    newMembers.map((member) => ({ ...member, createdAt: member.joinedAt })),
  )
  if (latestMember) {
    items.push({
      id: `member:${latestMember.id}`,
      kind: 'member',
      section: 'members',
      targetId: 'all',
      title: plural(newMembers.length, 'miembro nuevo', 'miembros nuevos'),
      count: newMembers.length,
      createdAt: latestMember.joinedAt,
      to: '/members',
    })
  }

  return items
}

export function summarizeNotifications(items: NotificationItem[]): NotificationSummary {
  const unique = new Map<string, NotificationItem>()
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item)
  }
  const byTarget: Record<string, number> = {}
  const bySection = emptySections()
  let total = 0
  for (const item of unique.values()) {
    const key = notificationKey(item.section, item.targetId)
    byTarget[key] = (byTarget[key] ?? 0) + item.count
    bySection[item.section] += item.count
    total += item.count
  }
  return { items: [...unique.values()], byTarget, bySection, total }
}

/** Ids que aún no se habían visto, para decidir si toca sonar. */
export function newNotificationIds(
  seenIds: readonly string[],
  items: ReadonlyArray<Pick<NotificationItem, 'id'>>,
): string[] {
  const seen = new Set(seenIds)
  return items.filter((item) => !seen.has(item.id)).map((item) => item.id)
}
