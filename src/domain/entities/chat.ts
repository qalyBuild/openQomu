import type { ChannelType } from './identity'

export interface Channel {
  id: string
  workspaceId: string
  name: string
  description: string
  type: ChannelType
  createdBy: string
  createdAt: string
  archived: boolean
  /** Creador y miembros explícitos. Vacío en canales públicos. */
  memberIds: string[]
}

export interface Message {
  id: string
  workspaceId: string
  channelId: string
  authorId: string
  authorName: string
  authorPhotoURL: string | null
  body: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  attachmentIds: string[]
  reactions: Record<string, string[]>
  replyToId: string | null
}

export interface MessageGroup {
  id: string
  authorId: string
  authorName: string
  authorPhotoURL: string | null
  createdAt: string
  messages: Message[]
}

/** Miembro que está escribiendo ahora mismo en un canal. */
export interface TypingUser {
  uid: string
  displayName: string
  updatedAt: string
}

/** Última vez que un miembro leyó el canal. */
export interface ChannelRead {
  uid: string
  lastReadAt: string
}

/** Estado de lectura de un mensaje propio. */
export type MessageReadState = 'sent' | 'read' | 'read-all'

export type FileBackend = 'firestore' | 'storage' | 's3' | 'local'

export interface FileMeta {
  id: string
  workspaceId: string
  name: string
  path: string
  /** URL directa solo en Storage/legacy. En Firestore gratuito se resuelve bajo demanda. */
  url: string
  size: number
  contentType: string
  uploadedBy: string
  createdAt: string
  updatedAt: string
  folderId: string | null
  trashedAt: string | null
  backend: FileBackend
}

export interface FileFolder {
  id: string
  workspaceId: string
  name: string
  parentId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_CHANNELS = [
  {
    name: 'general',
    description: 'Todo lo que el equipo necesita saber.',
    type: 'public' as ChannelType,
  },
  {
    name: 'producto',
    description: 'Decisiones de producto, roadmap y descubrimiento.',
    type: 'public' as ChannelType,
  },
  {
    name: 'diseño',
    description: 'Referencias, prototipos y feedback visual.',
    type: 'public' as ChannelType,
  },
]
