import { describe, expect, it } from 'vitest'
import {
  buildFcmMessage,
  buildLegacyFcmMessage,
  notificationGroupKey,
  supportsGroupedNotifications,
} from './fcm'

describe('buildFcmMessage', () => {
  it('envía solo datos para que el APK construya la notificación agrupada', () => {
    const message = buildFcmMessage('token-1', {
      id: 'event-1',
      title: 'Emérito en #general',
      body: 'Hola equipo',
      path: '/w/w1/c/c1',
    })
    expect(message.message.token).toBe('token-1')
    expect(message.message.data).toEqual({
      id: 'event-1',
      title: 'Emérito en #general',
      body: 'Hola equipo',
      path: '/w/w1/c/c1',
      groupKey: 'chat-c1',
    })
    expect(message.message.android.priority).toBe('high')
    expect(message.message).not.toHaveProperty('notification')
  })

  it('agrupa por chat o tablero', () => {
    expect(notificationGroupKey('/w/w1/c/c1')).toBe('chat-c1')
    expect(notificationGroupKey('/w/w1/boards/b1?task=t1')).toBe('board-b1')
    expect(notificationGroupKey('/w/w1')).toBe('openqomu')

    const message = buildFcmMessage('token-2', {
      id: 'event-2',
      title: 'Nueva tarea',
      body: 'Revisar',
      path: '/w/w1/boards/b1?task=t1',
    })
    expect(message.message.data.groupKey).toBe('board-b1')
  })

  it('detecta las APK que construyen el historial', () => {
    expect(supportsGroupedNotifications('1.0.9')).toBe(false)
    expect(supportsGroupedNotifications('1.0.10')).toBe(true)
    expect(supportsGroupedNotifications('1.1.0')).toBe(true)
    expect(supportsGroupedNotifications('2.0.0')).toBe(true)
    expect(supportsGroupedNotifications(null)).toBe(false)
  })

  it('mantiene el payload antiguo para APK anteriores a la 1.0.10', () => {
    const message = buildLegacyFcmMessage('token-3', {
      id: 'event-3',
      title: 'Emérito en #general',
      body: 'Hola equipo',
      path: '/w/w1/c/c1',
    })
    expect(message.message.notification).toEqual({
      title: 'Emérito en #general',
      body: 'Hola equipo',
    })
    expect(message.message.android.collapse_key).toBe('chat-c1')
    expect(message.message.android.notification.tag).toBe('chat-c1')
  })
})
