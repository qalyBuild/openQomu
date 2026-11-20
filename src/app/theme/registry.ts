import {
  DEFAULT_THEME_ID,
  resolveTheme,
  type Theme,
  type ThemeInput,
} from './tokens'
import { validateThemeInput } from './validate'
import { officialThemePackages } from './official-packages'

export { DEFAULT_THEME_ID }

export const THEMES_STORAGE_KEY = 'openqomu.themes.installed'
export const THEME_CATALOG_URL =
  'https://raw.githubusercontent.com/qalyBuild/openQomu/main/themes/index.json'

export const OFFICIAL_THEME_PACKAGES = officialThemePackages('openQomu')
export const BUILTIN_THEMES: Theme[] = OFFICIAL_THEME_PACKAGES.flatMap((item) => item.themes)
const BUILTIN_IDS = new Set(BUILTIN_THEMES.map((theme) => theme.id))

export function isBuiltinTheme(id: string) {
  return BUILTIN_IDS.has(id)
}

function readStorage(): ThemeInput[] {
  try {
    const raw = localStorage.getItem(THEMES_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const result = validateThemeInput(entry, { requireCore: true })
      if (!result.ok || isBuiltinTheme(result.value.id)) return []
      return [result.value]
    })
  } catch {
    return []
  }
}

function writeStorage(themes: ThemeInput[]) {
  try {
    localStorage.setItem(THEMES_STORAGE_KEY, JSON.stringify(themes))
  } catch {
    // Sin almacenamiento: el tema instalado dura la sesión.
  }
}

export function loadInstalledThemes(): Theme[] {
  return readStorage().map((item) => resolveTheme(item))
}

export function listThemes(): Theme[] {
  return [...BUILTIN_THEMES, ...loadInstalledThemes()]
}

export function findTheme(id: string): Theme | undefined {
  return listThemes().find((theme) => theme.id === id)
}

export function installTheme(input: unknown): Theme {
  const result = validateThemeInput(input, { requireCore: true })
  if (!result.ok) throw new Error(result.errors.join(' '))
  if (isBuiltinTheme(result.value.id)) {
    throw new Error('No se puede sobrescribir un tema incluido.')
  }
  const installed = readStorage().filter((theme) => theme.id !== result.value.id)
  writeStorage([...installed, result.value])
  return resolveTheme(result.value)
}

export function removeTheme(id: string): boolean {
  if (isBuiltinTheme(id)) return false
  const installed = readStorage()
  const next = installed.filter((theme) => theme.id !== id)
  if (next.length === installed.length) return false
  writeStorage(next)
  return true
}

export function parseCatalog(value: unknown): ThemeInput[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    const result = validateThemeInput(entry, { requireCore: true })
    if (!result.ok || seen.has(result.value.id)) return []
    seen.add(result.value.id)
    return [result.value]
  })
}

export async function fetchCatalog(
  fetcher: typeof fetch = fetch,
  url = THEME_CATALOG_URL,
): Promise<ThemeInput[]> {
  try {
    const response = await fetcher(url)
    if (!response.ok) return []
    return parseCatalog(await response.json())
  } catch {
    return []
  }
}
