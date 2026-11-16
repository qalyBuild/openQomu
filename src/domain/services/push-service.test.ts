import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/domain/errors'
import {
  createDeviceRegistration,
  createPushEvent,
  isNotifiableTaskUpdate,
  recipientsFor,
  validateDeviceToken,
} from './push-service'

describe('push-service', () => {
  it('valida y normaliza el registro de un dispositivo', () => {
    expect(
      createDeviceRegistration({
        id: '  device-1  ',
        token: '  fcm-token-con-suficiente-longitud-123  ',
        platform: 'android',
        appVersion: '  1.0.0  ',
      }),
    ).toEqual({
      id: 'device-1',
      token: 'fcm-token-con-suficiente-longitud-123',
      platform: 'android',
      appVersion: '1.0.0',
    })
  })

  it('rechaza tokens cortos y plataformas desconocidas', () => {
    expect(() => validateDeviceToken('corto')).toThrow(ValidationError)
    expect(() =>
      createDeviceRegistration({
        id: 'device-1',
        token: 'fcm-token-con-suficiente-longitud-123',
        // @ts-expect-error plataforma inválida a propósito
        platform: 'windows',
      }),
    ).toThrow('plataforma')
  })

  it('construye un evento de mensaje con sus identificadores', () => {
    const event = createPushEvent({
      kind: 'message.created',
      workspaceId: 'w1',
      actorId: 'u1',
      channelId: 'c1',
      messageId: 'm1',
      now: '2026-11-13T10:00:00.000Z',
    })
    expect(event).toMatchObject({
      kind: 'message.created',
      channelId: 'c1',
      messageId: 'm1',
      createdAt: '2026-11-13T10:00:00.000Z',
    })
  })

  it('exige el canal y el mensaje en eventos de mensaje', () => {
    expect(() =>
      createPushEvent({ kind: 'message.created', workspaceId: 'w1', actorId: 'u1' }),
    ).toThrow('canal')
    expect(() =>
      createPushEvent({
        kind: 'message.created',
        workspaceId: 'w1',
        actorId: 'u1',
        channelId: 'c1',
      }),
    ).toThrow('mensaje')
  })

  it('exige tablero y tarea en eventos de tarea', () => {
    expect(() =>
      createPushEvent({ kind: 'task.created', workspaceId: 'w1', actorId: 'u1' }),
    ).toThrow('tablero')
    expect(() =>
      createPushEvent({
        kind: 'task.comment',
        workspaceId: 'w1',
        actorId: 'u1',
        boardId: 'b1',
        taskId: 't1',
      }),
    ).toThrow('comentario')
  })

  it('filtra los campos notificables de una actualización de tarea', () => {
    const event = createPushEvent({
      kind: 'task.updated',
      workspaceId: 'w1',
      actorId: 'u1',
      boardId: 'b1',
      taskId: 't1',
      changedFields: ['title', 'assigneeIds', 'reviewerId', 'description'],
    })
    expect(event.changedFields).toEqual(['assigneeIds', 'reviewerId'])
    expect(isNotifiableTaskUpdate(event)).toBe(true)
    expect(
      isNotifiableTaskUpdate(
        createPushEvent({
          kind: 'task.updated',
          workspaceId: 'w1',
          actorId: 'u1',
          boardId: 'b1',
          taskId: 't1',
          changedFields: ['title'],
        }),
      ),
    ).toBe(false)
  })

  it('deduplica destinatarios y excluye al autor', () => {
    expect(recipientsFor('u1', ['u2', 'u2', 'u1', null, '', 'u3'])).toEqual(['u2', 'u3'])
  })
})
