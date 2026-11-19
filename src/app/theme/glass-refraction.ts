import type { ResolvedGlass } from './glass'

const SVG = 'http://www.w3.org/2000/svg'
const SURFACES = [
  '[data-glass-surface="chrome"]',
  '[data-glass-surface="overlay"]',
  '[data-glass-dashboard] [data-glass-surface="panel"]',
].join(',')
const MAX_SURFACES = 24
const MAP_CACHE_LIMIT = 24
let filterSequence = 0

/** Map a rounded rectangle's curved rim to inward samples of the live backdrop. */
export function renderRefractionMap(
  pixels: Uint8ClampedArray,
  columns: number,
  rows: number,
  width: number,
  height: number,
  corner: number,
  rim: number,
) {
  const halfX = width / 2
  const halfY = height / 2
  for (let row = 0; row < rows; row++) {
    const y = (row + 0.5) * height / rows - halfY
    const dy = Math.abs(y) - halfY + corner
    for (let column = 0; column < columns; column++) {
      const x = (column + 0.5) * width / columns - halfX
      const dx = Math.abs(x) - halfX + corner
      const outsideX = Math.max(0, dx)
      const outsideY = Math.max(0, dy)
      const distance = Math.hypot(outsideX, outsideY)
      const depth = corner - distance - Math.min(0, Math.max(dx, dy))
      const weight = depth < -2 ? 0 : Math.max(0, 1 - Math.max(0, depth) / rim) ** 1.65
      const normalX = distance ? outsideX / distance : Number(dx >= dy)
      const normalY = distance ? outsideY / distance : Number(dy > dx)
      const offset = (row * columns + column) * 4
      pixels[offset] = 128 - Math.sign(x) * normalX * weight * 126
      pixels[offset + 1] = 128 - Math.sign(y) * normalY * weight * 126
      pixels[offset + 2] = 128
      pixels[offset + 3] = 255
    }
  }
}

function createFilter(definitions: SVGDefsElement, scale: number) {
  const filter = document.createElementNS(SVG, 'filter')
  filter.id = `qomu-lens-${++filterSequence}`
  filter.setAttribute('filterUnits', 'objectBoundingBox')
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse')
  filter.setAttribute('color-interpolation-filters', 'sRGB')
  filter.setAttribute('x', '0')
  filter.setAttribute('y', '0')
  filter.setAttribute('width', '100%')
  filter.setAttribute('height', '100%')

  const image = document.createElementNS(SVG, 'feImage')
  image.setAttribute('preserveAspectRatio', 'none')
  image.setAttribute('result', 'refraction')
  const displacement = document.createElementNS(SVG, 'feDisplacementMap')
  displacement.setAttribute('in', 'SourceGraphic')
  displacement.setAttribute('in2', 'refraction')
  displacement.setAttribute('scale', String(scale))
  displacement.setAttribute('xChannelSelector', 'R')
  displacement.setAttribute('yChannelSelector', 'G')
  filter.append(image, displacement)
  definitions.append(filter)
  return { filter, image }
}

export function supportsBackdropRefraction() {
  // WebKit and Gecko can parse the syntax without applying SVG to the backdrop.
  return /(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent)
    && CSS.supports('backdrop-filter', 'url("#qomu-lens")')
}

export function attachGlassRefraction(definitions: SVGDefsElement, material: ResolvedGlass) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return

  const cache = new Map<string, string>()
  const active = new Map<HTMLElement, ReturnType<typeof createFilter>>()
  const resize = new ResizeObserver((entries) => {
    for (const { target, borderBoxSize, contentRect } of entries) {
      const surface = target as HTMLElement
      const lens = active.get(surface)
      if (!lens) continue
      const width = Math.round(borderBoxSize?.[0]?.inlineSize ?? contentRect.width)
      const height = Math.round(borderBoxSize?.[0]?.blockSize ?? contentRect.height)
      if (width < 8 || height < 8) continue
      const style = getComputedStyle(surface)
      const radius = style.borderTopLeftRadius
      const radiusValue = Number.parseFloat(radius) || 0
      const minSide = Math.min(width, height)
      const corner = Math.min(minSide / 2, radius.endsWith('%') ? radiusValue * minSide / 100 : radiusValue)
      const rim = Math.min(26, minSide * 0.44)
      const key = `${width}:${height}:${corner}`
      let map = cache.get(key)
      if (!map) {
        const limit = material.quality === 'high' ? 768 : material.quality === 'low' ? 256 : 512
        const resolution = Math.min(1, limit / Math.max(width, height))
        canvas.width = Math.max(2, Math.round(width * resolution))
        canvas.height = Math.max(2, Math.round(height * resolution))
        const image = context.createImageData(canvas.width, canvas.height)
        renderRefractionMap(image.data, canvas.width, canvas.height, width, height, corner, rim)
        context.putImageData(image, 0, 0)
        map = canvas.toDataURL()
        if (cache.size >= MAP_CACHE_LIMIT) cache.delete(cache.keys().next().value!)
        cache.set(key, map)
      }
      lens.image.setAttribute('width', String(width))
      lens.image.setAttribute('height', String(height))
      lens.image.setAttribute('href', map)
      surface.style.setProperty('--glass-displacement', `url("#${lens.filter.id}")`)
      surface.dataset.glassRefraction = 'live'
    }
  })

  const detach = (surface: HTMLElement) => {
    active.get(surface)?.filter.remove()
    active.delete(surface)
    resize.unobserve(surface)
    surface.style.removeProperty('--glass-displacement')
    delete surface.dataset.glassRefraction
  }

  let frame = 0
  const reconcile = () => {
    frame = 0
    const surfaces = [...document.querySelectorAll<HTMLElement>(SURFACES)]
      .filter((element) => element.getClientRects().length > 0)
      .sort((a, b) => Number(b.dataset.glassSurface === 'overlay') - Number(a.dataset.glassSurface === 'overlay'))
      .slice(0, MAX_SURFACES)
    const selected = new Set(surfaces)
    for (const surface of active.keys()) if (!selected.has(surface)) detach(surface)
    for (const surface of surfaces) {
      if (active.has(surface)) continue
      active.set(surface, createFilter(definitions, 64 * material.lensing))
      resize.observe(surface, { box: 'border-box' })
    }
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(reconcile)
  }
  const mutations = new MutationObserver((records) => {
    if (records.some((record) => !definitions.contains(record.target))) schedule()
  })
  mutations.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', schedule)
  schedule()
  return () => {
    mutations.disconnect()
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
    for (const surface of active.keys()) detach(surface)
    resize.disconnect()
  }
}

export function trackGlassHighlights() {
  let frame = 0
  const move = (event: PointerEvent) => {
    const surface = (event.target as Element | null)?.closest<HTMLElement>(SURFACES)
    if (!surface) return
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const { left, top } = surface.getBoundingClientRect()
      surface.style.setProperty('--glass-light-x', `${event.clientX - left}px`)
      surface.style.setProperty('--glass-light-y', `${event.clientY - top}px`)
    })
  }
  document.addEventListener('pointermove', move, { passive: true })
  document.addEventListener('pointerdown', move, { passive: true })
  return () => {
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerdown', move)
    cancelAnimationFrame(frame)
    for (const surface of document.querySelectorAll<HTMLElement>(SURFACES)) {
      surface.style.removeProperty('--glass-light-x')
      surface.style.removeProperty('--glass-light-y')
    }
  }
}
