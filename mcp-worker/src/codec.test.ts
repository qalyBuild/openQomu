import { describe, expect, it } from 'vitest'
import { decodeFields, encodeFields } from './codec'

describe('Firestore REST codec', () => {
  it('codifica y decodifica tipos anidados', () => {
    const input = {
      title: 'Tarea',
      order: 3,
      ratio: 1.5,
      done: false,
      dueDate: null,
      assigneeIds: ['u1', 'u2'],
      meta: { labels: ['bug'], nested: { value: 2 } },
    }
    expect(decodeFields(encodeFields(input))).toEqual(input)
  })

  it('maneja arrays vacíos y mapas vacíos', () => {
    const encoded = encodeFields({ items: [], meta: {} })
    expect(decodeFields(encoded)).toEqual({ items: [], meta: {} })
  })
})
