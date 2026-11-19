import {
  GLASS_MATERIALS,
  GLASS_NUMBER_RANGES,
  GLASS_OPTION_KEYS,
  GLASS_QUALITIES,
  GLASS_RENDERERS,
  type GlassOptions,
} from './glass'
import {
  THEME_EFFECTS,
  THEME_FONTS,
  THEME_SCHEMES,
  THEME_TOKENS,
  type ThemeEffect,
  type ThemeFont,
  type ThemeInput,
  type ThemeScheme,
  type ThemeToken,
} from './tokens'

export const MAX_THEME_BYTES = 32 * 1024
const MAX_TOKEN_VALUE = 100
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_FUNCTION = /^(rgb|rgba|hsl|hsla|oklch|oklab)\(([^()]*)\)$/i
const COLOR_BODY = /^[0-9a-z.,%/+\- ]+$/i
const LENGTH = /^[0-9]*\.?[0-9]+(rem|px|em)$/
const THEME_KEYS = new Set([
  'id',
  'name',
  'scheme',
  'version',
  'author',
  'license',
  'description',
  'tokens',
  'options',
])
const OPTION_KEYS = new Set(['font', 'effects', 'glass'])
const CORE_TOKENS: ThemeToken[] = ['background', 'foreground']

export type ValidationResult =
  | { ok: true; value: ThemeInput }
  | { ok: false; errors: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
}

function validColor(value: string) {
  if (HEX_COLOR.test(value)) return true
  const match = value.match(COLOR_FUNCTION)
  return Boolean(match && match[2].trim() && COLOR_BODY.test(match[2]))
}

function validTokenValue(token: ThemeToken, value: string) {
  return token === 'radius' ? LENGTH.test(value) : validColor(value)
}

export function validateThemeInput(
  input: unknown,
  { requireCore = false }: { requireCore?: boolean } = {},
): ValidationResult {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['El tema debe ser un objeto.'] }

  for (const key of Object.keys(input)) {
    if (!THEME_KEYS.has(key)) errors.push(`Clave desconocida: ${key}.`)
  }
  if (typeof input.id !== 'string' || !ID_PATTERN.test(input.id)) {
    errors.push('El id debe usar minúsculas, números y guiones (2-40).')
  }
  if (!text(input.name, 60)) errors.push('El nombre es obligatorio (máx. 60).')
  if (!THEME_SCHEMES.includes(input.scheme as ThemeScheme)) {
    errors.push('El esquema debe ser light o dark.')
  }
  if (!Number.isInteger(input.version) || (input.version as number) < 1 || (input.version as number) > 1000) {
    errors.push('La versión debe ser un entero entre 1 y 1000.')
  }
  if (!text(input.author, 80)) errors.push('El autor es obligatorio (máx. 80).')
  if (!text(input.license, 60)) errors.push('La licencia es obligatoria (máx. 60).')
  if (input.description !== undefined && !text(input.description, 300)) {
    errors.push('La descripción no puede superar 300 caracteres.')
  }

  const tokens = input.tokens ?? {}
  if (!isRecord(tokens)) {
    errors.push('tokens debe ser un objeto.')
  } else {
    for (const [key, value] of Object.entries(tokens)) {
      if (!(THEME_TOKENS as readonly string[]).includes(key)) {
        errors.push(`Token desconocido: ${key}.`)
        continue
      }
      if (typeof value !== 'string' || value.length > MAX_TOKEN_VALUE) {
        errors.push(`Valor inválido para ${key}.`)
        continue
      }
      const trimmed = value.trim()
      if (!validTokenValue(key as ThemeToken, trimmed)) {
        errors.push(`Valor no permitido para ${key}: ${trimmed}.`)
      }
    }
    if (requireCore) {
      for (const token of CORE_TOKENS) {
        if (typeof tokens[token] !== 'string' || !tokens[token]) {
          errors.push(`Falta el token ${token}.`)
        }
      }
    }
  }

  const options = input.options ?? {}
  if (!isRecord(options)) {
    errors.push('options debe ser un objeto.')
  } else {
    for (const key of Object.keys(options)) {
      if (!OPTION_KEYS.has(key)) errors.push(`Opción desconocida: ${key}.`)
    }
    if (options.font !== undefined && !THEME_FONTS.includes(options.font as ThemeFont)) {
      errors.push('Fuente no permitida.')
    }
    if (options.effects !== undefined) {
      const effects = options.effects
      if (!Array.isArray(effects) || !effects.every((effect) => THEME_EFFECTS.includes(effect as ThemeEffect))) {
        errors.push('Efecto no permitido.')
      } else if (new Set(effects).size !== effects.length) {
        errors.push('Efectos duplicados.')
      }
    }
    if (options.glass !== undefined) {
      errors.push(...validateGlass(options.glass, options.effects))
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      ...(input as unknown as ThemeInput),
      tokens: Object.fromEntries(
        Object.entries(tokens).map(([key, value]) => [key, String(value).trim()]),
      ),
    },
  }
}

function validateGlass(value: unknown, effects: unknown): string[] {
  const errors: string[] = []
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['glass debe ser un objeto.']
  }
  if (!Array.isArray(effects) || !effects.includes('glass')) {
    errors.push('glass requiere el efecto glass.')
  }
  const glass = value as Record<string, unknown>
  for (const key of Object.keys(glass)) {
    if (!GLASS_OPTION_KEYS.has(key as keyof GlassOptions)) errors.push(`Opción glass desconocida: ${key}.`)
  }
  if (glass.material !== undefined && !GLASS_MATERIALS.includes(glass.material as never)) {
    errors.push('Material de vidrio no permitido.')
  }
  if (glass.renderer !== undefined && !GLASS_RENDERERS.includes(glass.renderer as never)) {
    errors.push('Renderer de vidrio no permitido.')
  }
  if (glass.quality !== undefined && !GLASS_QUALITIES.includes(glass.quality as never)) {
    errors.push('Calidad de vidrio no permitida.')
  }
  for (const [key, range] of Object.entries(GLASS_NUMBER_RANGES)) {
    const current = glass[key]
    if (current === undefined) continue
    if (
      typeof current !== 'number' ||
      !Number.isFinite(current) ||
      current < range.min ||
      current > range.max
    ) {
      errors.push(`Valor de glass fuera de rango: ${key}.`)
    }
  }
  for (const key of ['tint', 'tintLight'] as const) {
    const current = glass[key]
    if (current === undefined) continue
    if (typeof current !== 'string' || current.length > MAX_TOKEN_VALUE || !validColor(current.trim())) {
      errors.push(`Color de glass no permitido: ${key}.`)
    }
  }
  if (glass.svg !== undefined && typeof glass.svg !== 'boolean') {
    errors.push('svg debe ser booleano.')
  }
  return errors
}

export function parseThemeFile(source: string): ValidationResult {
  if (source.length > MAX_THEME_BYTES) {
    return { ok: false, errors: ['El tema supera 32 KB.'] }
  }
  try {
    return validateThemeInput(JSON.parse(source), { requireCore: true })
  } catch {
    return { ok: false, errors: ['El archivo no es JSON válido.'] }
  }
}

export function serializeTheme(theme: ThemeInput) {
  return `${JSON.stringify(theme, null, 2)}\n`
}
