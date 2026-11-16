import { describe, expect, it } from 'vitest'
import type { Message } from '@/domain/entities/chat'
import {
  activeTypers,
  excerpt,
  extractMentions,
  groupMessages,
  mentionsName,
  normalizeSearchText,
  readReceipt,
  toggleReaction,
  totalReactions,
  typingLabel,
  validateMessageBody,
} from './message-service'

function makeMessage(overrides: Partial<Message>): Message {
  return {
    id: overrides.id ?? 'm1',
    workspaceId: 'ws',
    channelId: 'ch',
    authorId: 'u1',
    authorName: 'Ana',
    authorPhotoURL: null,
    body: 'Hola',
    createdAt: '2026-11-12T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: {},
    replyToId: null,
    ...overrides,
  }
}

describe('message-service', () => {
  it('valida mensajes vacíos y adjuntos', () => {
    expect(validateMessageBody('  Hola  ')).toBe('Hola')
    expect(validateMessageBody('', true)).toBe('')
    expect(() => validateMessageBody('   ')).toThrow('adjunta')
    expect(() => validateMessageBody('x'.repeat(8001))).toThrow('8000')
  })

  it('agrupa mensajes consecutivos del mismo autor en 5 minutos', () => {
    const groups = groupMessages([
      makeMessage({ id: 'a', createdAt: '2026-11-12T10:00:00.000Z' }),
      makeMessage({ id: 'b', createdAt: '2026-11-12T10:03:00.000Z' }),
      makeMessage({ id: 'c', authorId: 'u2', authorName: 'Bruno', createdAt: '2026-11-12T10:04:00.000Z' }),
      makeMessage({ id: 'd', createdAt: '2026-11-12T10:20:00.000Z' }),
    ])
    expect(groups).toHaveLength(3)
    expect(groups[0].messages.map((m) => m.id)).toEqual(['a', 'b'])
    expect(groups[1].authorId).toBe('u2')
    expect(groups[2].messages[0].id).toBe('d')
  })

  it('no agrupa respuestas de hilo', () => {
    const groups = groupMessages([
      makeMessage({ id: 'a' }),
      makeMessage({ id: 'b', replyToId: 'a', createdAt: '2026-11-12T10:01:00.000Z' }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('extrae menciones únicas y en minúsculas', () => {
    expect(extractMentions('Hola @Ana y @bruno, mira @Ana')).toEqual(['ana', 'bruno'])
    expect(extractMentions('email@example.com')).toEqual([])
  })

  it('alterna reacciones sin mutar y sin duplicados', () => {
    const reactions: Record<string, string[]> = { '👍': ['u1'], '🔥': ['u2'] }
    const added = toggleReaction(reactions, '🎉', 'u3')
    expect(added['🎉']).toEqual(['u3'])
    expect(reactions['🎉']).toBeUndefined()

    const removed = toggleReaction(added, '👍', 'u1')
    expect(removed['👍']).toBeUndefined()

    const toggledTwice = toggleReaction(toggleReaction(reactions, '👍', 'u2'), '👍', 'u2')
    expect(toggledTwice['👍']).toEqual(['u1'])
  })

  it('cuenta reacciones y genera extractos', () => {
    expect(totalReactions({ a: ['1', '2'], b: ['3'] })).toBe(3)
    expect(totalReactions({})).toBe(0)
    expect(excerpt('  Hola   mundo  ', 7)).toBe('Hola m…')
  })

  it('normaliza tildes para buscar menciones', () => {
    expect(normalizeSearchText('  Emérito  ')).toBe('emerito')
    expect(normalizeSearchText('Carla Méndez')).toBe('carla mendez')
    expect(extractMentions('Hola @Emérito y @bruno')).toEqual(['emerito', 'bruno'])
    expect(mentionsName('Hola @emerito, ¿viste esto?', 'Emérito')).toBe(true)
    expect(mentionsName('Hola @Emérito', 'Emérito')).toBe(true)
    expect(mentionsName('Hola @ernesto', 'Ernesto Rippl')).toBe(true)
    expect(mentionsName('Hola @ana', 'Emérito')).toBe(false)
    expect(mentionsName('Hola a todos', 'Emérito')).toBe(false)
  })

  it('filtra escritores caducados y resume la burbuja', () => {
    const now = new Date('2026-11-15T10:00:00.000Z').getTime()
    const fresh = { uid: 'u1', displayName: 'Ana Torres', updatedAt: '2026-11-15T09:59:58.000Z' }
    const stale = { uid: 'u2', displayName: 'Bruno Vidal', updatedAt: '2026-11-15T09:59:00.000Z' }
    const self = { uid: 'u3', displayName: 'Emérito', updatedAt: '2026-11-15T09:59:59.000Z' }

    expect(activeTypers([fresh, stale, self], { uid: 'u3', now })).toEqual([fresh])
    expect(typingLabel([])).toBe('')
    expect(typingLabel([fresh])).toBe('Ana está escribiendo…')
    expect(typingLabel([fresh, { displayName: 'Luis Pérez' }])).toBe(
      'Ana y Luis están escribiendo…',
    )
    expect(
      typingLabel([fresh, { displayName: 'Luis' }, { displayName: 'Carla' }]),
    ).toBe('Varias personas están escribiendo…')
  })

  it('calcula el visto solo en mensajes propios', () => {
    const message = makeMessage({ authorId: 'u1', createdAt: '2026-11-15T10:00:00.000Z' })
    const recipients = ['u1', 'u2', 'u3']

    expect(readReceipt(message, 'u2', {}, recipients)).toBeNull()
    expect(readReceipt(message, 'u1', {}, recipients)).toEqual({ state: 'sent', readers: [] })
    expect(
      readReceipt(message, 'u1', { u2: '2026-11-15T10:00:01.000Z' }, recipients),
    ).toEqual({ state: 'read', readers: ['u2'] })
    expect(
      readReceipt(
        message,
        'u1',
        { u2: '2026-11-15T10:00:01.000Z', u3: '2026-11-15T10:00:02.000Z' },
        recipients,
      ),
    ).toEqual({ state: 'read-all', readers: ['u2', 'u3'] })
    // Una lectura anterior al mensaje no cuenta.
    expect(
      readReceipt(message, 'u1', { u2: '2026-11-15T09:00:00.000Z' }, recipients),
    ).toEqual({ state: 'sent', readers: [] })
  })
})
