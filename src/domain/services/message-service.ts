import type {
  Message,
  MessageGroup,
  MessageReadState,
  TypingUser,
} from '@/domain/entities/chat'
import { ValidationError } from '@/domain/errors'

export const MAX_MESSAGE_LENGTH = 8000
export const GROUP_WINDOW_MS = 5 * 60 * 1000
/** Un indicador de escritura caduca si no se refresca en este tiempo. */
export const TYPING_TTL_MS = 6000
/** Un mensaje eliminado se muestra una hora y después desaparece sin dejar rastro. */
export const DELETED_MESSAGE_TTL_MS = 60 * 60 * 1000

export function isDeletedMessageExpired(message: Message, now: number = Date.now()): boolean {
  if (!message.deletedAt) return false
  return now - new Date(message.deletedAt).getTime() >= DELETED_MESSAGE_TTL_MS
}

/**
 * Normaliza texto para comparar nombres y menciones sin depender de tildes,
 * mayúsculas ni espacios sobrantes. `@emerito` debe encontrar a «Emérito».
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function validateMessageBody(body: string, hasAttachments = false): string {
  const trimmed = body.trim()
  if (!trimmed && !hasAttachments) {
    throw new ValidationError('Escribe un mensaje o adjunta un archivo.')
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(`El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.`)
  }
  return trimmed
}

export function groupMessages(
  messages: Message[],
  windowMs: number = GROUP_WINDOW_MS,
): MessageGroup[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const groups: MessageGroup[] = []

  for (const message of sorted) {
    const lastGroup = groups[groups.length - 1]
    const lastMessage = lastGroup?.messages[lastGroup.messages.length - 1]
    const withinWindow =
      lastMessage !== undefined &&
      new Date(message.createdAt).getTime() - new Date(lastMessage.createdAt).getTime() <= windowMs
    const canGroup =
      lastGroup !== undefined &&
      lastMessage !== undefined &&
      lastGroup.authorId === message.authorId &&
      withinWindow &&
      !message.replyToId &&
      !lastMessage.replyToId

    if (canGroup) {
      lastGroup.messages.push(message)
      continue
    }

    groups.push({
      id: message.id,
      authorId: message.authorId,
      authorName: message.authorName,
      authorPhotoURL: message.authorPhotoURL,
      createdAt: message.createdAt,
      messages: [message],
    })
  }

  return groups
}

export function extractMentions(body: string): string[] {
  const mentions = new Set<string>()
  const regex = /(?:^|\s)@([\p{L}\p{N}._-]{2,32})/gu
  let match = regex.exec(body)
  while (match) {
    mentions.add(normalizeSearchText(match[1]))
    match = regex.exec(body)
  }
  return [...mentions]
}

/** Indica si un cuerpo menciona a la persona, con o sin tildes. */
export function mentionsName(body: string, displayName: string | null | undefined): boolean {
  const name = displayName?.trim()
  if (!name) return false
  const normalizedBody = normalizeSearchText(body)
  const candidates = new Set([name, name.split(/\s+/)[0]])
  return [...candidates].some(
    (candidate) => candidate.length > 0 && normalizedBody.includes(`@${normalizeSearchText(candidate)}`),
  )
}

/** Escritores vigentes, sin duplicados y sin incluir al propio usuario. */
export function activeTypers(
  users: TypingUser[],
  options: { uid?: string; now?: number; ttlMs?: number } = {},
): TypingUser[] {
  const now = options.now ?? Date.now()
  const ttl = options.ttlMs ?? TYPING_TTL_MS
  const seen = new Set<string>()
  return users.filter((user) => {
    if (user.uid === options.uid || seen.has(user.uid)) return false
    if (now - new Date(user.updatedAt).getTime() > ttl) return false
    seen.add(user.uid)
    return true
  })
}

/** Texto de la burbuja de escritura. */
export function typingLabel(users: Array<Pick<TypingUser, 'displayName'>>): string {
  const names = [...new Set(users.map((user) => user.displayName.trim().split(/\s+/)[0]))]
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} está escribiendo…`
  if (names.length === 2) return `${names[0]} y ${names[1]} están escribiendo…`
  return 'Varias personas están escribiendo…'
}

/**
 * Estado de visto de un mensaje propio. Devuelve `null` si el mensaje no es
 * del usuario actual (no mostramos checks en mensajes ajenos).
 */
export function readReceipt(
  message: Pick<Message, 'authorId' | 'createdAt'>,
  uid: string,
  reads: Record<string, string | undefined>,
  recipientIds: string[],
): { state: MessageReadState; readers: string[] } | null {
  if (message.authorId !== uid) return null
  const createdAt = new Date(message.createdAt).getTime()
  const recipients = [...new Set(recipientIds)].filter((id) => id !== uid)
  const readers = recipients.filter((id) => {
    const readAt = reads[id]
    return Boolean(readAt) && new Date(readAt as string).getTime() >= createdAt
  })
  const state: MessageReadState =
    readers.length > 0 && readers.length === recipients.length
      ? 'read-all'
      : readers.length > 0
        ? 'read'
        : 'sent'
  return { state, readers }
}

export function toggleReaction(
  reactions: Record<string, string[]>,
  emoji: string,
  uid: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  for (const [key, uids] of Object.entries(reactions ?? {})) {
    next[key] = [...uids]
  }

  const current = next[emoji] ?? []
  if (current.includes(uid)) {
    const filtered = current.filter((candidate) => candidate !== uid)
    if (filtered.length > 0) next[emoji] = filtered
    else delete next[emoji]
  } else {
    next[emoji] = [...current, uid]
  }
  return next
}

export function totalReactions(reactions: Record<string, string[]>): number {
  return Object.values(reactions ?? {}).reduce((sum, uids) => sum + uids.length, 0)
}

export function excerpt(body: string, maxLength = 90): string {
  const clean = body.replace(/\s+/g, ' ').trim()
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1)}…`
}
