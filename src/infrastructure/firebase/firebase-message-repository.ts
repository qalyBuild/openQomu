import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import type {
  MessageRepository,
  SendMessageInput,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Message, TypingUser } from '@/domain/entities/chat'
import { NotFoundError } from '@/domain/errors'
import {
  toggleReaction as toggleReactionState,
  validateMessageBody,
} from '@/domain/services/message-service'
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'
import { mapMessage } from './mappers'

function db() {
  return getFirebaseDb()
}

function messagesCol(workspaceId: string, channelId: string) {
  return collection(db(), 'workspaces', workspaceId, 'channels', channelId, 'messages')
}

function messageRef(workspaceId: string, channelId: string, messageId: string) {
  return doc(db(), 'workspaces', workspaceId, 'channels', channelId, 'messages', messageId)
}

function typingCol(workspaceId: string, channelId: string) {
  return collection(db(), 'workspaces', workspaceId, 'channels', channelId, 'typing')
}

function readsCol(workspaceId: string, channelId: string) {
  return collection(db(), 'workspaces', workspaceId, 'channels', channelId, 'reads')
}

export class FirebaseMessageRepository implements MessageRepository {
  async list(workspaceId: string, channelId: string, limit = 200): Promise<Message[]> {
    const snapshot = await getDocs(
      query(messagesCol(workspaceId, channelId), orderBy('createdAt', 'asc'), limitToLast(limit)),
    )
    return snapshot.docs.map((document) =>
      mapMessage(document.id, workspaceId, channelId, document.data()),
    )
  }

  subscribe(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Message[]>,
    limit = 200,
  ): Unsubscribe {
    const q = query(
      messagesCol(workspaceId, channelId),
      orderBy('createdAt', 'asc'),
      limitToLast(limit),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        callback(
          snapshot.docs.map((document) =>
            mapMessage(document.id, workspaceId, channelId, document.data()),
          ),
        )
      },
      (error) => console.error('[openqomu] messages snapshot', error),
    )
  }

  async send(input: SendMessageInput): Promise<Message> {
    const attachmentIds = [...new Set(input.attachmentIds ?? [])]
    const body = validateMessageBody(input.body, attachmentIds.length > 0)
    const createdAt = nowIso()
    const reference = await addDoc(messagesCol(input.workspaceId, input.channelId), {
      authorId: input.author.id,
      authorName: input.author.displayName,
      authorPhotoURL: input.author.photoURL,
      body,
      createdAt,
      editedAt: null,
      deletedAt: null,
      attachmentIds,
      reactions: {},
      replyToId: input.replyToId ?? null,
    })
    return {
      id: reference.id,
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      authorId: input.author.id,
      authorName: input.author.displayName,
      authorPhotoURL: input.author.photoURL,
      body,
      createdAt,
      editedAt: null,
      deletedAt: null,
      attachmentIds,
      reactions: {},
      replyToId: input.replyToId ?? null,
    }
  }

  async updateBody(
    workspaceId: string,
    channelId: string,
    messageId: string,
    body: string,
  ): Promise<void> {
    const reference = messageRef(workspaceId, channelId, messageId)
    const validated = validateMessageBody(body)
    await updateDoc(reference, { body: validated, editedAt: nowIso() })
  }

  async remove(workspaceId: string, channelId: string, messageId: string): Promise<void> {
    await updateDoc(messageRef(workspaceId, channelId, messageId), {
      body: '',
      attachmentIds: [],
      reactions: {},
      deletedAt: nowIso(),
    })
  }

  async toggleReaction(
    workspaceId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    uid: string,
  ): Promise<void> {
    const reference = messageRef(workspaceId, channelId, messageId)
    await runTransaction(db(), async (transaction) => {
      const snapshot = await transaction.get(reference)
      if (!snapshot.exists()) throw new NotFoundError('El mensaje no existe.')
      const raw = snapshot.data().reactions
      const reactions =
        typeof raw === 'object' && raw !== null ? (raw as Record<string, string[]>) : {}
      transaction.update(reference, {
        reactions: toggleReactionState(reactions, emoji, uid),
      })
    })
  }

  async setTyping(
    workspaceId: string,
    channelId: string,
    user: { id: string; displayName: string },
    active: boolean,
  ): Promise<void> {
    const reference = doc(typingCol(workspaceId, channelId), user.id)
    if (!active) {
      await deleteDoc(reference)
      return
    }
    await setDoc(reference, {
      uid: user.id,
      displayName: user.displayName,
      updatedAt: nowIso(),
    })
  }

  subscribeTyping(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<TypingUser[]>,
  ): Unsubscribe {
    return onSnapshot(
      typingCol(workspaceId, channelId),
      (snapshot) => {
        callback(
          snapshot.docs.map((document) => {
            const data = document.data()
            return {
              uid: typeof data.uid === 'string' ? data.uid : document.id,
              displayName: typeof data.displayName === 'string' ? data.displayName : 'Alguien',
              updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
            }
          }),
        )
      },
      (error) => console.error('[openqomu] typing snapshot', error),
    )
  }

  async markRead(workspaceId: string, channelId: string, uid: string, at: string): Promise<void> {
    await setDoc(doc(readsCol(workspaceId, channelId), uid), { uid, lastReadAt: at })
  }

  subscribeReads(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Record<string, string>>,
  ): Unsubscribe {
    return onSnapshot(
      readsCol(workspaceId, channelId),
      (snapshot) => {
        const reads: Record<string, string> = {}
        for (const document of snapshot.docs) {
          const value = document.data().lastReadAt
          if (typeof value === 'string') reads[document.id] = value
        }
        callback(reads)
      },
      (error) => console.error('[openqomu] reads snapshot', error),
    )
  }
}
