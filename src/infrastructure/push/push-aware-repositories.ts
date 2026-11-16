import type {
  MessageRepository,
  PushOutbox,
  SendMessageInput,
  Subscriber,
  TaskRepository,
  Unsubscribe,
} from '@/domain/ports'
import type { Message, TypingUser } from '@/domain/entities/chat'
import type {
  BoardColumn,
  Task,
  TaskComment,
  TaskDraftInput,
} from '@/domain/entities/kanban'
import { createPushEvent, isNotifiableTaskUpdate } from '@/domain/services/push-service'

async function publish(outbox: PushOutbox, input: Parameters<typeof createPushEvent>[0]): Promise<void> {
  try {
    const event = createPushEvent(input)
    if (event.kind === 'task.updated' && !isNotifiableTaskUpdate(event)) return
    const id = await outbox.enqueue(event)
    void outbox.dispatch(id)
  } catch (error) {
    // Un fallo de push nunca debe romper la acción del usuario.
    console.warn('[openqomu] no se pudo encolar la notificación', error)
  }
}

/**
 * Decorador de MessageRepository: publica un evento al enviar un mensaje.
 * Abierto a extensión (OCP) sin tocar la implementación de Firebase.
 */
export class PushAwareMessageRepository implements MessageRepository {
  private readonly inner: MessageRepository
  private readonly outbox: PushOutbox

  constructor(inner: MessageRepository, outbox: PushOutbox) {
    this.inner = inner
    this.outbox = outbox
  }

  list(workspaceId: string, channelId: string, limit?: number): Promise<Message[]> {
    return this.inner.list(workspaceId, channelId, limit)
  }

  subscribe(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Message[]>,
    limit?: number,
  ): Unsubscribe {
    return this.inner.subscribe(workspaceId, channelId, callback, limit)
  }

  async send(input: SendMessageInput): Promise<Message> {
    const message = await this.inner.send(input)
    await publish(this.outbox, {
      kind: 'message.created',
      workspaceId: message.workspaceId,
      actorId: message.authorId,
      channelId: message.channelId,
      messageId: message.id,
    })
    return message
  }

  updateBody(
    workspaceId: string,
    channelId: string,
    messageId: string,
    body: string,
  ): Promise<void> {
    return this.inner.updateBody(workspaceId, channelId, messageId, body)
  }

  remove(workspaceId: string, channelId: string, messageId: string): Promise<void> {
    return this.inner.remove(workspaceId, channelId, messageId)
  }

  toggleReaction(
    workspaceId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    uid: string,
  ): Promise<void> {
    return this.inner.toggleReaction(workspaceId, channelId, messageId, emoji, uid)
  }

  setTyping(
    workspaceId: string,
    channelId: string,
    user: { id: string; displayName: string },
    active: boolean,
  ): Promise<void> {
    return this.inner.setTyping(workspaceId, channelId, user, active)
  }

  subscribeTyping(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<TypingUser[]>,
  ): Unsubscribe {
    return this.inner.subscribeTyping(workspaceId, channelId, callback)
  }

  markRead(workspaceId: string, channelId: string, uid: string, at: string): Promise<void> {
    return this.inner.markRead(workspaceId, channelId, uid, at)
  }

  subscribeReads(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Record<string, string>>,
  ): Unsubscribe {
    return this.inner.subscribeReads(workspaceId, channelId, callback)
  }
}

/** Decorador de TaskRepository: publica asignaciones, revisiones y comentarios. */
export class PushAwareTaskRepository implements TaskRepository {
  private readonly inner: TaskRepository
  private readonly outbox: PushOutbox
  private readonly currentUid: () => string | null

  constructor(inner: TaskRepository, outbox: PushOutbox, currentUid: () => string | null) {
    this.inner = inner
    this.outbox = outbox
    this.currentUid = currentUid
  }

  list(workspaceId: string, boardId: string): Promise<Task[]> {
    return this.inner.list(workspaceId, boardId)
  }

  subscribe(
    workspaceId: string,
    boardId: string,
    callback: Subscriber<Task[]>,
  ): Unsubscribe {
    return this.inner.subscribe(workspaceId, boardId, callback)
  }

  async create(input: TaskDraftInput): Promise<Task> {
    const task = await this.inner.create(input)
    await publish(this.outbox, {
      kind: 'task.created',
      workspaceId: task.workspaceId,
      actorId: task.createdBy,
      boardId: task.boardId,
      taskId: task.id,
    })
    return task
  }

  async update(
    workspaceId: string,
    boardId: string,
    taskId: string,
    patch: Parameters<TaskRepository['update']>[3],
  ): Promise<void> {
    await this.inner.update(workspaceId, boardId, taskId, patch)
    const changedFields = Object.keys(patch)
    if (changedFields.length === 0) return
    const actorId = this.currentUid()
    if (!actorId) return
    await publish(this.outbox, {
      kind: 'task.updated',
      workspaceId,
      actorId,
      boardId,
      taskId,
      changedFields,
    })
  }

  move(
    workspaceId: string,
    boardId: string,
    taskId: string,
    toColumnId: string,
    toIndex: number,
    columns: BoardColumn[],
  ): Promise<void> {
    return this.inner.move(workspaceId, boardId, taskId, toColumnId, toIndex, columns)
  }

  async transfer(
    workspaceId: string,
    boardId: string,
    taskId: string,
    target: Parameters<TaskRepository['transfer']>[3],
    actorId: string,
  ): Promise<Task> {
    const task = await this.inner.transfer(workspaceId, boardId, taskId, target, actorId)
    await publish(this.outbox, {
      kind: 'task.updated',
      workspaceId: task.workspaceId,
      actorId,
      boardId: task.boardId,
      taskId: task.id,
      changedFields: ['assigneeIds', 'reviewerId'],
    })
    return task
  }

  remove(workspaceId: string, boardId: string, taskId: string): Promise<void> {
    return this.inner.remove(workspaceId, boardId, taskId)
  }

  subscribeComments(
    workspaceId: string,
    boardId: string,
    taskId: string,
    callback: Subscriber<TaskComment[]>,
  ): Unsubscribe {
    return this.inner.subscribeComments(workspaceId, boardId, taskId, callback)
  }

  async addComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    comment: Parameters<TaskRepository['addComment']>[3],
  ): Promise<TaskComment> {
    const created = await this.inner.addComment(workspaceId, boardId, taskId, comment)
    await publish(this.outbox, {
      kind: 'task.comment',
      workspaceId,
      actorId: created.authorId,
      boardId,
      taskId,
      commentId: created.id,
    })
    return created
  }

  removeComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
  ): Promise<void> {
    return this.inner.removeComment(workspaceId, boardId, taskId, commentId)
  }

  updateComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
    body: string,
  ): Promise<void> {
    return this.inner.updateComment(workspaceId, boardId, taskId, commentId, body)
  }
}
