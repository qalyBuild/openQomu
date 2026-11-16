import { beforeEach, describe, expect, it } from 'vitest'
import type { PushOutbox, TaskRepository } from '@/domain/ports'
import { DemoPushOutbox } from '@/infrastructure/demo/demo-push-outbox'
import { DemoDeviceRepository } from '@/infrastructure/demo/demo-device-repository'
import { createDemoContainer } from '@/infrastructure/demo'
import { DemoStore } from '@/infrastructure/demo/store'
import { DEMO_WORKSPACE_ID } from '@/infrastructure/demo/seed'
import {
  PushAwareMessageRepository,
  PushAwareTaskRepository,
} from './push-aware-repositories'

const DEVICE_TOKEN = 'fcm-token-de-prueba-con-longitud-suficiente'

describe('DemoDeviceRepository', () => {
  let devices: DemoDeviceRepository

  beforeEach(() => {
    devices = new DemoDeviceRepository()
  })

  it('registra, actualiza el token y conserva createdAt', async () => {
    const first = await devices.register('u-alex', {
      id: 'device-1',
      token: DEVICE_TOKEN,
      platform: 'android',
      appVersion: '1.0.0',
    })
    const second = await devices.register('u-alex', {
      id: 'device-1',
      token: `${DEVICE_TOKEN}-2`,
      platform: 'android',
      appVersion: '1.0.1',
    })
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.token).toBe(`${DEVICE_TOKEN}-2`)
    expect(await devices.list('u-alex')).toHaveLength(1)
  })

  it('permite desactivar y eliminar el dispositivo', async () => {
    await devices.register('u-alex', {
      id: 'device-1',
      token: DEVICE_TOKEN,
      platform: 'android',
    })
    await devices.setEnabled('u-alex', 'device-1', false)
    expect((await devices.get('u-alex', 'device-1'))?.enabled).toBe(false)
    await devices.remove('u-alex', 'device-1')
    expect(await devices.get('u-alex', 'device-1')).toBeNull()
  })
})

describe('decoradores de push', () => {
  let container: ReturnType<typeof createDemoContainer>
  let outbox: DemoPushOutbox
  let messages: PushAwareMessageRepository
  let tasks: PushAwareTaskRepository
  let boardId: string

  beforeEach(async () => {
    const store = new DemoStore({ seed: true, persist: false })
    container = createDemoContainer(store)
    outbox = new DemoPushOutbox()
    messages = new PushAwareMessageRepository(container.messages, outbox)
    tasks = new PushAwareTaskRepository(
      container.tasks,
      outbox,
      () => 'u-alex',
    )
    const boards = await container.boards.list(DEMO_WORKSPACE_ID)
    boardId = boards[0].id
  })

  it('encola un evento al enviar un mensaje', async () => {
    const sent = await messages.send({
      workspaceId: DEMO_WORKSPACE_ID,
      channelId: 'ch-general',
      author: { id: 'u-alex', displayName: 'Alex', photoURL: null },
      body: 'Hola push',
    })
    expect(outbox.events).toEqual([
      expect.objectContaining({
        kind: 'message.created',
        channelId: 'ch-general',
        messageId: sent.id,
        actorId: 'u-alex',
      }),
    ])
  })

  it('encola creación, asignación y comentario de tarea', async () => {
    const created = await tasks.create({
      workspaceId: DEMO_WORKSPACE_ID,
      boardId,
      title: 'Tarea con push',
      columnId: 'todo',
      createdBy: 'u-alex',
      assigneeIds: ['u-ana'],
    })
    expect(outbox.events.at(-1)).toMatchObject({ kind: 'task.created', taskId: created.id })

    await tasks.update(DEMO_WORKSPACE_ID, boardId, created.id, { title: 'Sin push' })
    expect(outbox.events).toHaveLength(1)

    await tasks.update(DEMO_WORKSPACE_ID, boardId, created.id, { reviewerId: 'u-ana' })
    expect(outbox.events.at(-1)).toMatchObject({
      kind: 'task.updated',
      changedFields: ['reviewerId'],
    })

    const comment = await tasks.addComment(DEMO_WORKSPACE_ID, boardId, created.id, {
      authorId: 'u-alex',
      authorName: 'Alex',
      authorPhotoURL: null,
      body: 'Comentario',
    })
    expect(outbox.events.at(-1)).toMatchObject({
      kind: 'task.comment',
      taskId: created.id,
      commentId: comment.id,
    })
  })

  it('no encola si el outbox falla', async () => {
    const failing: PushOutbox = {
      enqueue: async () => {
        throw new Error('offline')
      },
      dispatch: async () => {},
    }
    const decorated = new PushAwareMessageRepository(container.messages, failing)
    const sent = await decorated.send({
      workspaceId: DEMO_WORKSPACE_ID,
      channelId: 'ch-general',
      author: { id: 'u-alex', displayName: 'Alex', photoURL: null },
      body: 'Sigue funcionando',
    })
    expect(sent.body).toBe('Sigue funcionando')
  })

  it('expone el mismo contrato de tareas que el repositorio base', async () => {
    const list = await tasks.list(DEMO_WORKSPACE_ID, boardId)
    const direct = await container.tasks.list(DEMO_WORKSPACE_ID, boardId)
    expect(list).toEqual(direct)
    const taskRepository: TaskRepository = tasks
    expect(typeof taskRepository.move).toBe('function')
  })
})
