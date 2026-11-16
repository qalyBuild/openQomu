import { describe, expect, it } from 'vitest'
import type {
  ChannelRecord,
  DeviceRecord,
  FcmSender,
  MessageRecord,
  NotificationContent,
  OutboxEvent,
  Store,
  TaskRecord,
  WorkspaceRecord,
} from './domain'
import { MAX_ATTEMPTS, processEvent, processPending } from './processor'

class MemoryStore implements Store {
  events = new Map<string, OutboxEvent>()
  devices = new Map<string, DeviceRecord[]>()
  deleted: Array<{ uid: string; id: string }> = []
  message: MessageRecord | null = null
  channel: ChannelRecord | null = null
  workspace: WorkspaceRecord | null = null
  task: TaskRecord | null = null

  async getEvent(id: string) {
    const event = this.events.get(id)
    return event ? { ...event } : null
  }

  async listByStatus(status: OutboxEvent['status'], limit: number) {
    return [...this.events.values()]
      .filter((event) => event.status === status)
      .slice(0, limit)
      .map((event) => ({ ...event }))
  }

  async claim(event: OutboxEvent) {
    const current = this.events.get(event.id)
    if (!current || (current.status !== 'pending' && current.status !== 'processing')) return false
    this.events.set(event.id, {
      ...current,
      status: 'processing',
      attempts: current.attempts + 1,
      claimedAt: new Date().toISOString(),
    })
    return true
  }

  async markProcessed(event: OutboxEvent) {
    const current = this.events.get(event.id)!
    this.events.set(event.id, { ...current, status: 'processed', processedAt: new Date().toISOString() })
  }

  async recordFailure(event: OutboxEvent, message: string) {
    const current = this.events.get(event.id)!
    this.events.set(event.id, {
      ...current,
      status: current.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      claimedAt: null,
      lastError: message,
    })
  }

  async getMessage() {
    return this.message
  }
  async getComment() {
    return null
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
  async listDevices(uid: string) {
    return this.devices.get(uid) ?? []
  }
  async deleteDevice(uid: string, deviceId: string) {
    this.deleted.push({ uid, id: deviceId })
    this.devices.set(
      uid,
      (this.devices.get(uid) ?? []).filter((device) => device.id !== deviceId),
    )
  }
}

class FakeFcm implements FcmSender {
  calls: Array<{ tokens: string[]; content: NotificationContent; legacy: boolean }> = []
  invalidTokens: string[] = []
  fail = false

  async send(tokens: string[], content: NotificationContent, legacy = false) {
    this.calls.push({ tokens, content, legacy })
    if (this.fail) throw new Error('FCM caído')
    return { delivered: tokens.length, invalidTokens: this.invalidTokens }
  }
}

function setup() {
  const store = new MemoryStore()
  store.workspace = { id: 'w1', name: 'openQomu', memberIds: ['u1', 'u2', 'u3'] }
  store.channel = { id: 'c1', name: 'general', type: 'public', memberIds: [] }
  store.message = {
    id: 'm1',
    authorId: 'u1',
    authorName: 'Emérito',
    body: 'Hola equipo',
    attachmentIds: [],
  }
  store.events.set('e1', {
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
  })
  store.devices.set('u2', [
    { id: 'd2', uid: 'u2', token: 'tok-u2', enabled: true, appVersion: '1.0.10' },
  ])
  store.devices.set('u3', [
    { id: 'd3', uid: 'u3', token: 'tok-u3', enabled: false, appVersion: '1.0.9' },
  ])
  return { store, fcm: new FakeFcm() }
}

describe('processEvent', () => {
  it('entrega a los dispositivos activos y marca el evento', async () => {
    const { store, fcm } = setup()
    const result = await processEvent(store, fcm, 'e1')
    expect(result).toBe('processed')
    expect(fcm.calls).toHaveLength(1)
    expect(fcm.calls[0].tokens).toEqual(['tok-u2'])
    expect(fcm.calls[0].legacy).toBe(false)
    expect(store.events.get('e1')?.status).toBe('processed')
    expect(store.events.get('e1')?.attempts).toBe(1)
  })

  it('usa el payload antiguo para APK anteriores a la 1.0.10', async () => {
    const { store, fcm } = setup()
    store.devices.set('u2', [
      { id: 'd2', uid: 'u2', token: 'tok-u2', enabled: true, appVersion: '1.0.9' },
    ])
    await processEvent(store, fcm, 'e1')
    expect(fcm.calls).toHaveLength(1)
    expect(fcm.calls[0].legacy).toBe(true)
  })

  it('separa los envíos por versión de la APK', async () => {
    const { store, fcm } = setup()
    store.workspace!.memberIds = ['u1', 'u2', 'u4']
    store.devices.set('u4', [
      { id: 'd4', uid: 'u4', token: 'tok-u4', enabled: true, appVersion: '1.0.9' },
    ])
    await processEvent(store, fcm, 'e1')
    expect(fcm.calls).toHaveLength(2)
    expect(fcm.calls.find((call) => call.legacy)?.tokens).toEqual(['tok-u4'])
    expect(fcm.calls.find((call) => !call.legacy)?.tokens).toEqual(['tok-u2'])
  })

  it('es idempotente con eventos ya procesados', async () => {
    const { store, fcm } = setup()
    store.events.get('e1')!.status = 'processed'
    expect(await processEvent(store, fcm, 'e1')).toBe('skipped')
    expect(fcm.calls).toHaveLength(0)
  })

  it('marca procesado si no hay destinatarios', async () => {
    const { store, fcm } = setup()
    store.workspace!.memberIds = ['u1']
    expect(await processEvent(store, fcm, 'e1')).toBe('empty')
    expect(fcm.calls).toHaveLength(0)
    expect(store.events.get('e1')?.status).toBe('processed')
  })

  it('elimina tokens inválidos', async () => {
    const { store, fcm } = setup()
    fcm.invalidTokens = ['tok-u2']
    await processEvent(store, fcm, 'e1')
    expect(store.deleted).toEqual([{ uid: 'u2', id: 'd2' }])
  })

  it('reintenta tras un fallo de FCM', async () => {
    const { store, fcm } = setup()
    fcm.fail = true
    expect(await processEvent(store, fcm, 'e1')).toBe('failed')
    const event = store.events.get('e1')!
    expect(event.status).toBe('pending')
    expect(event.attempts).toBe(1)
    expect(event.lastError).toContain('FCM')
  })

  it('abandona tras el máximo de intentos', async () => {
    const { store, fcm } = setup()
    store.events.get('e1')!.attempts = MAX_ATTEMPTS
    expect(await processEvent(store, fcm, 'e1')).toBe('failed')
    expect(store.events.get('e1')?.status).toBe('failed')
  })

  it('reclama eventos atascados en processing', async () => {
    const { store, fcm } = setup()
    const event = store.events.get('e1')!
    store.events.set('e1', {
      ...event,
      status: 'processing',
      claimedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    })
    expect(await processEvent(store, fcm, 'e1')).toBe('processed')
  })

  it('no reclama eventos processing recientes', async () => {
    const { store, fcm } = setup()
    const event = store.events.get('e1')!
    store.events.set('e1', {
      ...event,
      status: 'processing',
      claimedAt: new Date().toISOString(),
    })
    expect(await processEvent(store, fcm, 'e1')).toBe('skipped')
  })

  it('devuelve missing para eventos inexistentes', async () => {
    const { store, fcm } = setup()
    expect(await processEvent(store, fcm, 'nope')).toBe('missing')
  })
})

describe('processPending', () => {
  it('procesa pendientes y atascados y cuenta resultados', async () => {
    const { store, fcm } = setup()
    store.events.set('e2', {
      ...store.events.get('e1')!,
      id: 'e2',
      status: 'processing',
      claimedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    })
    const counts = await processPending(store, fcm)
    expect(counts.processed).toBe(2)
    expect(counts.failed).toBe(0)
  })
})
