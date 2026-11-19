import { describe, expect, it } from 'vitest'
import { collectGlassSurfaces, MAX_GLASS_SURFACES } from './surfaces'

function surface(
  tier: string,
  rect: { x: number; y: number; width: number; height: number },
  visible = true,
) {
  const element = document.createElement('div')
  element.dataset.glassSurface = tier
  element.getBoundingClientRect = () =>
    ({
      ...rect,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      toJSON: () => rect,
    }) as DOMRect
  element.checkVisibility = () => visible
  return element
}

function rootWith(...elements: HTMLElement[]) {
  const root = document.createElement('div')
  for (const element of elements) root.append(element)
  return root
}

describe('collectGlassSurfaces', () => {
  it('descarta elementos ocultos o fuera del viewport', () => {
    const root = rootWith(
      surface('panel', { x: 10, y: 10, width: 200, height: 120 }),
      surface('panel', { x: 10, y: 10, width: 200, height: 120 }, false),
      surface('panel', { x: 2000, y: 10, width: 200, height: 120 }),
    )
    expect(collectGlassSurfaces(root, { width: 1000, height: 800 })).toHaveLength(1)
  })

  it('prioriza overlays y chrome sobre paneles', () => {
    const root = rootWith(
      surface('panel', { x: 10, y: 10, width: 400, height: 200 }),
      surface('chrome', { x: 0, y: 0, width: 240, height: 800 }),
      surface('overlay', { x: 300, y: 200, width: 300, height: 300 }),
    )
    const result = collectGlassSurfaces(root, { width: 1000, height: 800 })
    expect(result.map((item) => item.tier)).toEqual(['overlay', 'chrome', 'panel'])
  })

  it('limita el número de lentes', () => {
    const elements = Array.from({ length: MAX_GLASS_SURFACES + 10 }, (_, index) =>
      surface('panel', { x: index, y: index, width: 100, height: 80 }),
    )
    expect(collectGlassSurfaces(rootWith(...elements), { width: 2000, height: 2000 })).toHaveLength(
      MAX_GLASS_SURFACES,
    )
  })

  it('calcula fuerza por nivel y redondeo', () => {
    const root = rootWith(surface('chrome', { x: 0, y: 0, width: 240, height: 800 }))
    const [target] = collectGlassSurfaces(root, { width: 1000, height: 800 })
    expect(target.strength).toBeGreaterThan(1)
    expect(target.radius).toBeGreaterThan(0)
  })
})
