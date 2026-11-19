import type { ThemeScheme } from './tokens'

export const GLASS_MATERIALS = ['clear', 'regular', 'frosted'] as const
export type GlassMaterial = (typeof GLASS_MATERIALS)[number]

export const GLASS_RENDERERS = ['auto', 'css', 'webgl'] as const
export type GlassRenderer = (typeof GLASS_RENDERERS)[number]

export const GLASS_QUALITIES = ['auto', 'high', 'medium', 'low'] as const
export type GlassQuality = (typeof GLASS_QUALITIES)[number]

export interface GlassOptions {
  material?: GlassMaterial
  renderer?: GlassRenderer
  quality?: GlassQuality
  tint?: string
  tintLight?: string
  blur?: number
  opacity?: number
  saturation?: number
  brightness?: number
  rim?: number
  lensing?: number
  shadow?: number
  lightAngle?: number
  lightSpread?: number
  grid?: number
  caustics?: number
  svg?: boolean
}

export interface ResolvedGlass {
  material: GlassMaterial
  renderer: GlassRenderer
  quality: GlassQuality
  tint: string
  tintLight: string
  blur: number
  opacity: number
  saturation: number
  brightness: number
  rim: number
  lensing: number
  shadow: number
  lightAngle: number
  lightSpread: number
  grid: number
  caustics: number
  svg: boolean
}

export const GLASS_OPTION_KEYS = new Set<keyof GlassOptions>([
  'material',
  'renderer',
  'quality',
  'tint',
  'tintLight',
  'blur',
  'opacity',
  'saturation',
  'brightness',
  'rim',
  'lensing',
  'shadow',
  'lightAngle',
  'lightSpread',
  'grid',
  'caustics',
  'svg',
])

export const GLASS_NUMBER_RANGES: Partial<
  Record<keyof GlassOptions, { min: number; max: number }>
> = {
  blur: { min: 0, max: 60 },
  opacity: { min: 0.05, max: 0.9 },
  saturation: { min: 0.5, max: 2 },
  brightness: { min: 0.5, max: 1.5 },
  rim: { min: 0, max: 2 },
  lensing: { min: 0, max: 2 },
  shadow: { min: 0, max: 2 },
  lightAngle: { min: 0, max: 360 },
  lightSpread: { min: 0, max: 170 },
  grid: { min: 0, max: 1 },
  caustics: { min: 0, max: 1 },
}

const MATERIAL_PRESETS: Record<GlassMaterial, { blur: number; opacity: number; rim: number }> = {
  clear: { blur: 12, opacity: 0.3, rim: 0.55 },
  regular: { blur: 22, opacity: 0.42, rim: 0.75 },
  frosted: { blur: 34, opacity: 0.58, rim: 0.9 },
}

export function resolveGlass(options: GlassOptions | undefined, scheme: ThemeScheme): ResolvedGlass {
  const material = options?.material ?? 'regular'
  const preset = MATERIAL_PRESETS[material]
  return {
    material,
    renderer: options?.renderer ?? 'auto',
    quality: options?.quality ?? 'auto',
    tint: options?.tint ?? (scheme === 'dark' ? '#0b0f14' : '#ffffff'),
    tintLight: options?.tintLight ?? '#ffffff',
    blur: options?.blur ?? preset.blur,
    opacity:
      options?.opacity ?? (scheme === 'dark' ? preset.opacity : Math.min(0.9, preset.opacity + 0.12)),
    saturation: options?.saturation ?? 1.35,
    brightness: options?.brightness ?? (scheme === 'dark' ? 0.76 : 1.04),
    rim: options?.rim ?? preset.rim,
    lensing: options?.lensing ?? 1,
    shadow: options?.shadow ?? 1,
    lightAngle: options?.lightAngle ?? 340,
    lightSpread: options?.lightSpread ?? 110,
    grid: options?.grid ?? 0.22,
    caustics: options?.caustics ?? 0.15,
    svg: options?.svg ?? true,
  }
}

export function glassCssVars(glass: ResolvedGlass): Record<string, string> {
  return {
    '--glass-blur': `${glass.blur}px`,
    '--glass-saturation': String(glass.saturation),
    '--glass-brightness': String(glass.brightness),
    '--glass-tint': glass.tint,
    '--glass-tint-light': glass.tintLight,
    '--glass-surface-alpha': String(glass.opacity),
    '--glass-rim-strength': String(glass.rim),
    '--glass-lensing': String(glass.lensing),
    '--glass-shadow': String(glass.shadow),
    '--glass-light-angle': `${glass.lightAngle}deg`,
    '--glass-light-spread': `${glass.lightSpread}deg`,
    '--glass-grid': String(glass.grid),
    '--glass-caustics': String(glass.caustics),
  }
}
