import type {
  MessageRepository,
  SendMessageInput,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Message, TypingUser } from '@/domain/entities/chat'
import { NotFoundError, ValidationError } from '@/domain/errors'
import {
  toggleReaction as toggleReactionState,
  validateMessageBody,
} from '@/domain/services/message-service'
import type { DemoStore } from './store'
import { createId } from './store'
import { listMessages } from './selectors'

export class DemoMessageRepository implements MessageRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async list(workspaceId: string, channelId: string, limit = 200): Promise<Message[]> {
    return listMessages(this.store.getState(), workspaceId, channelId, limit)
  }

  subscribe(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Message[]>,
    limit = 200,
  ): Unsubscribe {
    const emit = () =>
      callback(listMessages(this.store.getState(), workspaceId, channelId, limit))
    emit()
    return this.store.subscribe(emit)
  }

  async send(input: SendMessageInput): Promise<Message> {
    const state = this.store.getState()
    const channel = state.channels[input.channelId]
    if (!channel || channel.workspaceId !== input.workspaceId) {
      throw new NotFoundError('El canal no existe.')
    }
    const attachmentIds = [...new Set(input.attachmentIds ?? [])]
    const body = validateMessageBody(input.body, attachmentIds.length > 0)
    if (input.replyToId) {
      const parent = state.messages[input.replyToId]
      if (!parent || parent.channelId !== input.channelId) {
        throw new ValidationError('El mensaje al que respondes no existe.')
      }
    }

    const message: Message = {
      id: createId('msg'),
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      authorId: input.author.id,
      authorName: input.author.displayName,
      authorPhotoURL: input.author.photoURL,
      body,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      attachmentIds,
      reactions: {},
      replyToId: input.replyToId ?? null,
    }
    this.store.commit((draft) => {
      draft.messages[message.id] = message
    })
    return message
  }

  async updateBody(
    workspaceId: string,
    channelId: string,
    messageId: string,
    body: string,
  ): Promise<void> {
    const message = this.requireMessage(workspaceId, channelId, messageId)
    const validated = validateMessageBody(body, message.attachmentIds.length > 0)
    this.store.commit((draft) => {
      const target = draft.messages[messageId]
      if (!target) return
      target.body = validated
      target.editedAt = new Date().toISOString()
    })
  }

  async remove(workspaceId: string, channelId: string, messageId: string): Promise<void> {
    this.requireMessage(workspaceId, channelId, messageId)
    this.store.commit((draft) => {
      const target = draft.messages[messageId]
      if (!target) return
      target.body = ''
      target.attachmentIds = []
      target.reactions = {}
      target.deletedAt = new Date().toISOString()
    })
  }

  async toggleReaction(
    workspaceId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    uid: string,
  ): Promise<void> {
    this.requireMessage(workspaceId, channelId, messageId)
    this.store.commit((draft) => {
      const target = draft.messages[messageId]
      if (!target) return
      target.reactions = toggleReactionState(target.reactions, emoji, uid)
    })
  }

  private requireMessage(workspaceId: string, channelId: string, messageId: string): Message {
    const message = this.store.getState().messages[messageId]
    if (!message || message.workspaceId !== workspaceId || message.channelId !== channelId) {
      throw new NotFoundError('El mensaje no existe.')
    }
    return message
  }

  async setTyping(
    workspaceId: string,
    channelId: string,
    user: { id: string; displayName: string },
    active: boolean,
  ): Promise<void> {
    const channel = this.store.getState().channels[channelId]
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new NotFoundError('El canal no existe.')
    }
    const key = `${channelId}:${user.id}`
    this.store.commit((draft) => {
      if (active) {
        draft.typing[key] = {
          uid: user.id,
          displayName: user.displayName,
          updatedAt: new Date().toISOString(),
        }
      } else {
        delete draft.typing[key]
      }
    })
  }

  subscribeTyping(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<TypingUser[]>,
  ): Unsubscribe {
    const emit = () => {
      const channel = this.store.getState().channels[channelId]
      if (!channel || channel.workspaceId !== workspaceId) {
        callback([])
        return
      }
      callback(
        Object.entries(this.store.getState().typing)
          .filter(([key]) => key.startsWith(`${channelId}:`))
          .map(([, value]) => value),
      )
    }
    emit()
    return this.store.subscribe(emit)
  }

  async markRead(workspaceId: string, channelId: string, uid: string, at: string): Promise<void> {
    const channel = this.store.getState().channels[channelId]
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new NotFoundError('El canal no existe.')
    }
    const key = `${channelId}:${uid}`
    this.store.commit((draft) => {
      draft.reads[key] = { uid, lastReadAt: at }
    })
  }

  subscribeReads(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Record<string, string>>,
  ): Unsubscribe {
    const emit = () => {
      const channel = this.store.getState().channels[channelId]
      if (!channel || channel.workspaceId !== workspaceId) {
        callback({})
        return
      }
      const reads: Record<string, string> = {}
      for (const [key, value] of Object.entries(this.store.getState().reads)) {
        if (key.startsWith(`${channelId}:`)) reads[value.uid] = value.lastReadAt
      }
      callback(reads)
    }
    emit()
    return this.store.subscribe(emit)
  }
}
