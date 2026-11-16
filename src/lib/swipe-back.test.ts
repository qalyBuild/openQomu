import { describe, expect, it } from 'vitest'
import { resolveSwipe } from './swipe-back'

const base = { startY: 200, endY: 200 }

describe('resolveSwipe', () => {
  it('detecta el arrastre hacia la derecha', () => {
    expect(resolveSwipe({ ...base, startX: 20, endX: 120 })).toBe('right')
    expect(resolveSwipe({ ...base, startX: 380, endX: 480 })).toBe('right')
  })

  it('detecta el arrastre hacia la izquierda', () => {
    expect(resolveSwipe({ ...base, startX: 380, endX: 280 })).toBe('left')
    expect(resolveSwipe({ ...base, startX: 20, endX: -80 })).toBe('left')
  })

  it('funciona también empezando en los bordes', () => {
    expect(resolveSwipe({ ...base, startX: 0, endX: 100 })).toBe('right')
    expect(resolveSwipe({ ...base, startX: 399, endX: 299 })).toBe('left')
  })

  it('ignora gestos cortos o verticales', () => {
    expect(resolveSwipe({ ...base, startX: 120, endX: 160 })).toBeNull()
    expect(resolveSwipe({ ...base, startX: 120, endX: 220, endY: 320 })).toBeNull()
    expect(resolveSwipe({ ...base, startX: 120, endX: 120, endY: 300 })).toBeNull()
  })

  it('respeta umbrales configurables', () => {
    expect(
      resolveSwipe({ ...base, startX: 120, endX: 150, distanceThreshold: 20 }),
    ).toBe('right')
    expect(
      resolveSwipe({ ...base, startX: 120, endX: 220, verticalTolerance: 10, endY: 240 }),
    ).toBeNull()
  })
})
