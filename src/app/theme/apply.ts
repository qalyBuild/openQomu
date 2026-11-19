import { THEME_EFFECTS, type Theme, type ThemeScheme } from './tokens'

export const THEME_CACHE_KEY = 'openqomu.theme.cache'
const EFFECT_CLASSES = THEME_EFFECTS.map((effect) => `theme-${effect}`)
let appliedTokens: string[] = []

export interface ThemeCache {
  id: string
  scheme: ThemeScheme
  background: string
  foreground: string
  radius: string
}

export function writeThemeCache(cache: ThemeCache | null) {
  try {
    if (cache) localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(cache))
    else localStorage.removeItem(THEME_CACHE_KEY)
  } catch {
    // Sin almacenamiento: el tema sigue aplicado en esta sesión.
  }
}

export function readThemeCache(): ThemeCache | null {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<ThemeCache>
    if (
      typeof value.id === 'string' &&
      (value.scheme === 'light' || value.scheme === 'dark') &&
      typeof value.background === 'string' &&
      typeof value.foreground === 'string' &&
      typeof value.radius === 'string'
    ) {
      return value as ThemeCache
    }
  } catch {
    // Caché corrupta.
  }
  return null
}

export function clearTheme() {
  const root = document.documentElement
  for (const token of appliedTokens) root.style.removeProperty(`--${token}`)
  appliedTokens = []
  root.classList.remove('dark')
  root.removeAttribute('data-theme')
  root.removeAttribute('data-font')
  root.style.colorScheme = ''
  document.body.classList.remove(...EFFECT_CLASSES)
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const token of appliedTokens) root.style.removeProperty(`--${token}`)
  appliedTokens = Object.keys(theme.tokens)
  for (const [token, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${token}`, value)
  }

  root.classList.toggle('dark', theme.scheme === 'dark')
  root.style.colorScheme = theme.scheme
  root.dataset.theme = theme.id
  root.dataset.font = theme.options.font

  document.body.classList.remove(...EFFECT_CLASSES)
  for (const effect of theme.options.effects) document.body.classList.add(`theme-${effect}`)

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.tokens.background)

  writeThemeCache({
    id: theme.id,
    scheme: theme.scheme,
    background: theme.tokens.background,
    foreground: theme.tokens.foreground,
    radius: theme.tokens.radius,
  })
  return theme
}
