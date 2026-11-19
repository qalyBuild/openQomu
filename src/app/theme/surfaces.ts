export const MAX_GLASS_SURFACES = 32
const MIN_SURFACE_SIZE = 64

export type GlassTier = 'chrome' | 'overlay'

export interface GlassSurface {
  x: number
  y: number
  width: number
  height: number
  radius: number
  tier: GlassTier
  strength: number
}

const TIER_STRENGTH: Record<GlassTier, number> = {
  chrome: 1.15,
  overlay: 1.3,
}

const TIER_ORDER: Record<GlassTier, number> = {
  overlay: 3,
  chrome: 2,
}

function isVisible(element: Element) {
  const withCheck = element as Element & {
    checkVisibility?: (options?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean
  }
  if (typeof withCheck.checkVisibility === 'function') {
    return withCheck.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  }
  const style = getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

export function collectGlassSurfaces(
  root: ParentNode,
  viewport: { width: number; height: number },
  limit = MAX_GLASS_SURFACES,
): GlassSurface[] {
  const surfaces: GlassSurface[] = []
  for (const element of root.querySelectorAll('[data-glass-surface]')) {
    const tier = element.getAttribute('data-glass-surface')
    if ((tier !== 'chrome' && tier !== 'overlay') || !isVisible(element)) continue
    const rect = element.getBoundingClientRect()
    if (rect.width < MIN_SURFACE_SIZE || rect.height < MIN_SURFACE_SIZE) continue
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewport.width || rect.top >= viewport.height) {
      continue
    }
    const radius =
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 16
    surfaces.push({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      radius,
      tier,
      strength: TIER_STRENGTH[tier],
    })
  }
  surfaces.sort((a, b) => {
    const tier = TIER_ORDER[b.tier] - TIER_ORDER[a.tier]
    if (tier !== 0) return tier
    return b.width * b.height - a.width * a.height
  })
  return surfaces.slice(0, limit)
}
