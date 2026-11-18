import type {
  ChannelRecord,
  CommentRecord,
  DeviceRecord,
  EventKind,
  EventStatus,
  MessageRecord,
  OutboxEvent,
  Store,
  TaskRecord,
  WorkspaceRecord,
} from './domain'
import type { Env } from './env'
import {
  deleteDocument,
  getDocument,
  listCollection,
  queryEquals,
  updateDocument,
} from './firestore'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function mapEvent(id: string, data: Record<string, unknown>, updateTime?: string): OutboxEvent {
  return {
    id,
    kind: asString(data.kind) as EventKind,
    workspaceId: asString(data.workspaceId),
    actorId: asString(data.actorId),
    createdBy: asString(data.createdBy),
    channelId: asNullableString(data.channelId),
    boardId: asNullableString(data.boardId),
    taskId: asNullableString(data.taskId),
    messageId: asNullableString(data.messageId),
    commentId: asNullableString(data.commentId),
    changedFields: asStringArray(data.changedFields),
    createdAt: asString(data.createdAt),
    status: asString(data.status, 'pending') as EventStatus,
    attempts: typeof data.attempts === 'number' ? data.attempts : 0,
    claimedAt: asNullableString(data.claimedAt),
    processedAt: asNullableString(data.processedAt),
    lastError: asNullableString(data.lastError),
    updateTime,
  }
}

export class FirestoreStore implements Store {
  private readonly env: Env

  constructor(env: Env) {
    this.env = env
  }

  async getEvent(id: string): Promise<OutboxEvent | null> {
    const document = await getDocument(this.env, `pushOutbox/${id}`)
    return document ? mapEvent(document.id, document.data, document.updateTime) : null
  }

  async listByStatus(status: EventStatus, limit: number): Promise<OutboxEvent[]> {
    const documents = await queryEquals(this.env, '', 'pushOutbox', 'status', status, limit)
    return documents.map((document) => mapEvent(document.id, document.data, document.updateTime))
  }

  async claim(event: OutboxEvent): Promise<boolean> {
    return updateDocument(
      this.env,
      `pushOutbox/${event.id}`,
      {
        status: 'processing',
        attempts: event.attempts + 1,
        claimedAt: new Date().toISOString(),
      },
      event.updateTime,
    )
  }

  async markProcessed(event: OutboxEvent): Promise<void> {
    await updateDocument(this.env, `pushOutbox/${event.id}`, {
      status: 'processed',
      processedAt: new Date().toISOString(),
      claimedAt: null,
      lastError: null,
    })
  }

  async recordFailure(event: OutboxEvent, message: string): Promise<void> {
    const attempts = event.attempts + 1
    await updateDocument(this.env, `pushOutbox/${event.id}`, {
      status: attempts >= 5 ? 'failed' : 'pending',
      claimedAt: null,
      lastError: message.slice(0, 300),
    })
  }

  async getMessage(
    workspaceId: string,
    channelId: string,
    messageId: string,
  ): Promise<MessageRecord | null> {
    const document = await getDocument(
      this.env,
      `workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}`,
    )
    if (!document) return null
    return {
      id: document.id,
      authorId: asString(document.data.authorId),
      authorName: asString(document.data.authorName, 'Alguien'),
      body: asString(document.data.body),
      attachmentIds: asStringArray(document.data.attachmentIds),
      deletedAt: asNullableString(document.data.deletedAt),
    }
  }

  async getComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
  ): Promise<CommentRecord | null> {
    const document = await getDocument(
      this.env,
      `workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
    )
    if (!document) return null
    return {
      id: document.id,
      authorId: asString(document.data.authorId),
      authorName: asString(document.data.authorName, 'Alguien'),
      body: asString(document.data.body),
    }
  }

  async getChannel(workspaceId: string, channelId: string): Promise<ChannelRecord | null> {
    const document = await getDocument(
      this.env,
      `workspaces/${workspaceId}/channels/${channelId}`,
    )
    if (!document) return null
    return {
      id: document.id,
      name: asString(document.data.name),
      type: document.data.type === 'private' ? 'private' : 'public',
      memberIds: asStringArray(document.data.memberIds),
    }
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceRecord | null> {
    const document = await getDocument(this.env, `workspaces/${workspaceId}`)
    if (!document) return null
    return {
      id: document.id,
      name: asString(document.data.name),
      memberIds: asStringArray(document.data.memberIds),
    }
  }

  async getBoard(workspaceId: string, boardId: string): Promise<{ status?: string } | null> {
    const document = await getDocument(this.env, `workspaces/${workspaceId}/boards/${boardId}`)
    return document ? { status: asString(document.data.status) } : null
  }

  async getTask(
    workspaceId: string,
    boardId: string,
    taskId: string,
  ): Promise<TaskRecord | null> {
    const document = await getDocument(
      this.env,
      `workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`,
    )
    if (!document) return null
    return {
      id: document.id,
      title: asString(document.data.title),
      assigneeIds: asStringArray(document.data.assigneeIds),
      reviewerId: asNullableString(document.data.reviewerId),
      createdBy: asString(document.data.createdBy),
    }
  }

  async listDevices(uid: string): Promise<DeviceRecord[]> {
    const documents = await listCollection(this.env, `users/${uid}`, 'devices')
    return documents.map((document) => ({
      id: document.id,
      uid,
      token: asString(document.data.token),
      enabled: document.data.enabled !== false,
      appVersion: asNullableString(document.data.appVersion),
    }))
  }

  async deleteDevice(uid: string, deviceId: string): Promise<void> {
    await deleteDocument(this.env, `users/${uid}/devices/${deviceId}`)
  }
}
