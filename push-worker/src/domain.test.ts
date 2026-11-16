import { describe, expect, it } from 'vitest'
import {
  excerpt,
  isNotifiableUpdate,
  resolveNotification,
  type ChannelRecord,
  type DeviceRecord,
  type OutboxEvent,
  type Store,
  type TaskRecord,
  type WorkspaceRecord,
} from './domain'

class FakeStore implements Store {
  event: OutboxEvent | null = null
  message: { id: string; authorId: string; authorName: string; body: string; attachmentIds: string[]; deletedAt?: string | null } | null = null
  comment: { id: string; authorId: string; authorName: string; body: string } | null = null
  channel: ChannelRecord | null = null
  workspace: WorkspaceRecord | null = null
  task: TaskRecord | null = null

  async getEvent() {
    return this.event
  }
  async listByStatus() {
    return []
  }
  async claim() {
    return true
  }
  async markProcessed() {}
  async recordFailure() {}
  async getMessage() {
    return this.message
  }
  async getComment() {
    return this.comment
  }
  async getChannel() {
    return this.channel
  }
  async getWorkspace() {
    return this.workspace
  }
  async getTask() {
    return this.task
  }
  async listDevices(): Promise<DeviceRecord[]> {
    return []
  }
  async deleteDevice() {}
}

function event(overrides: Partial<OutboxEvent>): OutboxEvent {
  return {
    id: 'e1',
    kind: 'message.created',
    workspaceId: 'w1',
    actorId: 'u1',
    createdBy: 'u1',
    channelId: 'c1',
    boardId: null,
    taskId: null,
    messageId: 'm1',
    commentId: null,
    changedFields: [],
    createdAt: '2026-11-13T10:00:00.000Z',
    status: 'pending',
    attempts: 0,
    ...overrides,
  }
}

function storeWithMessage(): FakeStore {
  const store = new FakeStore()
  store.workspace = { id: 'w1', name: 'openQomu', memberIds: ['u1', 'u2', 'u3'] }
  store.channel = { id: 'c1', name: 'general', type: 'public', memberIds: [] }
  store.message = {
    id: 'm1',
    authorId: 'u1',
    authorName: 'Emérito',
    body: 'Hola   equipo,   vamos allá',
    attachmentIds: [],
  }
  return store
}

describe('resolveNotification', () => {
  it('notifica a los miembros del workspace en canales públicos', async () => {
    const resolved = await resolveNotification(storeWithMessage(), event({}))
    expect(resolved?.recipients).toEqual(['u2', 'u3'])
    expect(resolved?.content).toEqual({
      id: 'e1',
      title: 'Emérito en #general',
      body: 'Hola equipo, vamos allá',
      path: '/w/w1/c/c1',
    })
  })

  it('limita los canales privados a sus miembros', async () => {
    const store = storeWithMessage()
    store.channel = { id: 'c1', name: 'privado', type: 'private', memberIds: ['u1', 'u4'] }
    const resolved = await resolveNotification(store, event({}))
    expect(resolved?.recipients).toEqual(['u4'])
  })

  it('usa un texto alternativo para mensajes con adjuntos', async () => {
    const store = storeWithMessage()
    store.message!.body = ''
    store.message!.attachmentIds = ['f1']
    const resolved = await resolveNotification(store, event({}))
    expect(resolved?.content.body).toBe('Envió un archivo adjunto')
  })

  it('ignora mensajes eliminados o inexistentes', async () => {
    const store = storeWithMessage()
    store.message!.deletedAt = '2026-11-13T11:00:00.000Z'
    expect(await resolveNotification(store, event({}))).toBeNull()
    store.message = null
    expect(await resolveNotification(store, event({}))).toBeNull()
  })

  it('notifica tareas asignadas excluyendo al autor', async () => {
    const store = new FakeStore()
    store.task = { id: 't1', title: 'Crear app', assigneeIds: ['u2', 'u1'], reviewerId: 'u3', createdBy: 'u1' }
    const resolved = await resolveNotification(
      store,
      event({ kind: 'task.created', messageId: null, boardId: 'b1', taskId: 't1', channelId: null }),
    )
    expect(resolved?.recipients).toEqual(['u2', 'u3'])
    expect(resolved?.content.title).toBe('Nueva tarea asignada')
    expect(resolved?.content.path).toBe('/w/w1/boards/b1?task=t1')
  })

  it('solo notifica cambios de responsables o revisión', async () => {
    const store = new FakeStore()
    store.task = { id: 't1', title: 'Crear app', assigneeIds: ['u2'], reviewerId: 'u3', createdBy: 'u1' }
    const base = event({
      kind: 'task.updated',
      messageId: null,
      boardId: 'b1',
      taskId: 't1',
      channelId: null,
      changedFields: ['title'],
    })
    expect(await resolveNotification(store, base)).toBeNull()
    const review = await resolveNotification(store, {
      ...base,
      changedFields: ['reviewerId'],
    })
    expect(review?.content.title).toBe('Revisión solicitada')
    expect(review?.recipients).toEqual(['u3'])
  })

  it('incluye el autor y el texto del comentario', async () => {
    const store = new FakeStore()
    store.task = { id: 't1', title: 'Crear app', assigneeIds: ['u2'], reviewerId: null, createdBy: 'u1' }
    store.comment = { id: 'cm1', authorId: 'u3', authorName: 'Lucas', body: 'Falta el icono' }
    const resolved = await resolveNotification(
      store,
      event({
        kind: 'task.comment',
        messageId: null,
        boardId: 'b1',
        taskId: 't1',
        commentId: 'cm1',
        channelId: null,
      }),
    )
    expect(resolved?.content.title).toBe('Lucas comentó en «Crear app»')
    expect(resolved?.content.body).toBe('Falta el icono')
  })
})

describe('helpers', () => {
  it('recorta textos largos', () => {
    expect(excerpt('a'.repeat(200)).length).toBeLessThanOrEqual(140)
    expect(excerpt('  hola   mundo ')).toBe('hola mundo')
  })

  it('identifica actualizaciones notificables', () => {
    expect(isNotifiableUpdate({ kind: 'task.updated', changedFields: ['assigneeIds'] })).toBe(true)
    expect(isNotifiableUpdate({ kind: 'task.updated', changedFields: ['title'] })).toBe(false)
    expect(isNotifiableUpdate({ kind: 'task.comment', changedFields: [] })).toBe(true)
  })
})
