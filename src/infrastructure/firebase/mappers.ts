import type { Channel, FileFolder, FileMeta, Message } from '@/domain/entities/chat'
import type {
  Invite,
  Member,
  Priority,
  Role,
  User,
  Workspace,
} from '@/domain/entities/identity'
import { PRIORITY_VALUES, ROLE_VALUES } from '@/domain/entities/identity'
import type { Board, BoardColumn, Task, TaskComment } from '@/domain/entities/kanban'
import { DEFAULT_BOARD_COLUMNS, isBoardStatus } from '@/domain/entities/kanban'
import type { Page } from '@/domain/entities/pages'
import { EMPTY_PAGE_CONTENT } from '@/domain/entities/pages'
import type { DocumentData } from 'firebase/firestore'
import {
  asBoolean,
  asNullableString,
  asNumber,
  asString,
  asStringArray,
  asStringRecord,
} from './firestore-utils'

export function mapUser(id: string, data: DocumentData): User {
  return {
    id,
    displayName: asString(data.displayName, 'Usuario'),
    email: asString(data.email),
    photoURL: asNullableString(data.photoURL),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    lastActiveAt: asNullableString(data.lastActiveAt),
  }
}

export function mapWorkspace(id: string, data: DocumentData): Workspace {
  return {
    id,
    name: asString(data.name, 'Espacio de trabajo'),
    icon: asString(data.icon, '🪐'),
    description: asString(data.description),
    ownerId: asString(data.ownerId),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    memberIds: asStringArray(data.memberIds),
  }
}

function toRole(value: unknown): Role {
  return (ROLE_VALUES as readonly string[]).includes(String(value)) ? (value as Role) : 'member'
}

function toPriority(value: unknown): Priority {
  return (PRIORITY_VALUES as readonly string[]).includes(String(value))
    ? (value as Priority)
    : 'medium'
}

export function mapMember(id: string, workspaceId: string, data: DocumentData): Member {
  return {
    id,
    workspaceId,
    uid: asString(data.uid, id),
    role: toRole(data.role),
    displayName: asString(data.displayName, 'Miembro'),
    email: asString(data.email),
    photoURL: asNullableString(data.photoURL),
    joinedAt: asString(data.joinedAt, new Date().toISOString()),
    lastActiveAt: asNullableString(data.lastActiveAt),
  }
}

export function mapInvite(code: string, data: DocumentData): Invite {
  return {
    code,
    workspaceId: asString(data.workspaceId),
    createdBy: asString(data.createdBy),
    createdAt: asString(data.createdAt),
    expiresAt: asString(data.expiresAt),
  }
}

export function mapChannel(id: string, workspaceId: string, data: DocumentData): Channel {
  return {
    id,
    workspaceId,
    name: asString(data.name, 'canal'),
    description: asString(data.description),
    type: data.type === 'private' ? 'private' : 'public',
    createdBy: asString(data.createdBy),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    archived: asBoolean(data.archived),
    memberIds: asStringArray(data.memberIds),
  }
}

export function mapMessage(id: string, workspaceId: string, channelId: string, data: DocumentData): Message {
  return {
    id,
    workspaceId,
    channelId,
    authorId: asString(data.authorId),
    authorName: asString(data.authorName, 'Usuario'),
    authorPhotoURL: asNullableString(data.authorPhotoURL),
    body: asString(data.body),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    editedAt: asNullableString(data.editedAt),
    deletedAt: asNullableString(data.deletedAt),
    attachmentIds: asStringArray(data.attachmentIds),
    reactions: asStringRecord(data.reactions),
    replyToId: asNullableString(data.replyToId),
  }
}

function mapColumns(value: unknown): BoardColumn[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_BOARD_COLUMNS
  return value.map((entry) => {
    const column = entry as Record<string, unknown>
    return {
      id: asString(column.id, 'todo'),
      name: asString(column.name, 'Sin nombre'),
      color: asString(column.color, '#94a3b8'),
      isDone: asBoolean(column.isDone),
    }
  })
}

export function mapBoard(id: string, workspaceId: string, data: DocumentData): Board {
  const status: unknown = data.status
  return {
    id,
    workspaceId,
    name: asString(data.name, 'Tablero'),
    description: asString(data.description),
    status: isBoardStatus(status) ? status : 'normal',
    columns: mapColumns(data.columns),
    hiddenLabels: Array.isArray(data.hiddenLabels)
      ? data.hiddenLabels.filter((label): label is string => typeof label === 'string')
      : [],
    customLabels: Array.isArray(data.customLabels)
      ? data.customLabels.filter((label): label is string => typeof label === 'string')
      : [],
    createdAt: asString(data.createdAt, new Date().toISOString()),
    createdBy: asString(data.createdBy),
  }
}

function resolveDependencyIds(data: DocumentData): string[] {
  const list = asStringArray(data.dependsOnTaskIds).filter(Boolean)
  if (list.length > 0) return list
  // Compatibilidad con el campo único anterior.
  const legacy = asNullableString(data.dependsOnTaskId)
  return legacy ? [legacy] : []
}

export function mapTask(id: string, workspaceId: string, boardId: string, data: DocumentData): Task {
  return {
    id,
    workspaceId,
    boardId,
    title: asString(data.title, 'Sin título'),
    description: asString(data.description),
    columnId: asString(data.columnId, 'todo'),
    order: asNumber(data.order),
    assigneeIds: asStringArray(data.assigneeIds),
    reviewerId: asNullableString(data.reviewerId),
    priority: toPriority(data.priority),
    dueDate: asNullableString(data.dueDate),
    labels: asStringArray(data.labels),
    attachmentIds: asStringArray(data.attachmentIds),
    dependsOnTaskIds: resolveDependencyIds(data),
    createdBy: asString(data.createdBy),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    updatedAt: asString(data.updatedAt, new Date().toISOString()),
    completedAt: asNullableString(data.completedAt),
  }
}

export function mapComment(
  id: string,
  workspaceId: string,
  boardId: string,
  taskId: string,
  data: DocumentData,
): TaskComment {
  return {
    id,
    workspaceId,
    boardId,
    taskId,
    authorId: asString(data.authorId),
    authorName: asString(data.authorName, 'Usuario'),
    authorPhotoURL: asNullableString(data.authorPhotoURL),
    body: asString(data.body),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    editedAt: asNullableString(data.editedAt),
  }
}

export function mapPage(id: string, workspaceId: string, data: DocumentData): Page {
  return {
    id,
    workspaceId,
    title: asString(data.title, 'Sin título'),
    icon: asString(data.icon, '📄'),
    content: asString(data.content, EMPTY_PAGE_CONTENT),
    parentId: asNullableString(data.parentId),
    createdBy: asString(data.createdBy),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    updatedAt: asString(data.updatedAt, new Date().toISOString()),
    updatedBy: asString(data.updatedBy),
    archived: asBoolean(data.archived),
  }
}

export function mapFile(id: string, workspaceId: string, data: DocumentData): FileMeta {
  const path = asString(data.path)
  const url = asString(data.url)
  const rawBackend = data.backend
  const backend =
    rawBackend === 'storage' || rawBackend === 's3' || rawBackend === 'local' || rawBackend === 'firestore'
      ? rawBackend
      : url.startsWith('data:') || path.startsWith('firestore://')
        ? 'firestore'
        : 'storage'
  return {
    id,
    workspaceId,
    name: asString(data.name, 'archivo'),
    path,
    url,
    size: asNumber(data.size),
    contentType: asString(data.contentType, 'application/octet-stream'),
    uploadedBy: asString(data.uploadedBy),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    updatedAt: asString(data.updatedAt, asString(data.createdAt, new Date().toISOString())),
    folderId: asNullableString(data.folderId),
    trashedAt: asNullableString(data.trashedAt),
    backend,
  }
}

export function mapFolder(id: string, workspaceId: string, data: DocumentData): FileFolder {
  return {
    id,
    workspaceId,
    name: asString(data.name, 'Carpeta'),
    parentId: asNullableString(data.parentId),
    createdBy: asString(data.createdBy),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    updatedAt: asString(data.updatedAt, asString(data.createdAt, new Date().toISOString())),
  }
}
