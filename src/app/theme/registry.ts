import {
  DEFAULT_THEME_ID,
  resolveTheme,
  type Theme,
  type ThemeInput,
} from './tokens'
import { validateThemeInput } from './validate'

export { DEFAULT_THEME_ID }

export const THEMES_STORAGE_KEY = 'openqomu.themes.installed'
export const THEME_CATALOG_URL =
  'https://raw.githubusercontent.com/qalyBuild/openQomu/main/themes/index.json'

const BUILTIN_INPUTS: ThemeInput[] = [
  {
    id: 'qomu-light',
    name: 'openQomu Claro',
    scheme: 'light',
    version: 1,
    author: 'Qomu',
    license: 'AGPL-3.0',
    description: 'El estilo claro original de openQomu.',
    tokens: {},
  },
  {
    id: 'qomu-dark',
    name: 'openQomu Oscuro',
    scheme: 'dark',
    version: 1,
    author: 'Qomu',
    license: 'AGPL-3.0',
    description: 'El estilo oscuro original de openQomu.',
    tokens: {},
  },
  {
    id: 'liquid-glass-light',
    name: 'Liquid Glass Claro',
    scheme: 'light',
    version: 1,
    author: 'Qomu',
    license: 'AGPL-3.0',
    description: 'Vidrio claro con refracción del contenido en movimiento.',
    tokens: {
      background: 'oklch(0.965 0.012 245)',
      foreground: 'oklch(0.24 0.03 255)',
      card: 'oklch(0.99 0.006 245)',
      'card-foreground': 'oklch(0.24 0.03 255)',
      popover: 'oklch(0.995 0.005 245)',
      'popover-foreground': 'oklch(0.24 0.03 255)',
      primary: 'oklch(0.47 0.17 255)',
      'primary-foreground': 'oklch(0.99 0 0)',
      secondary: 'oklch(0.93 0.02 250)',
      'secondary-foreground': 'oklch(0.3 0.04 255)',
      muted: 'oklch(0.93 0.015 250)',
      'muted-foreground': 'oklch(0.43 0.04 255)',
      accent: 'oklch(0.9 0.04 245)',
      'accent-foreground': 'oklch(0.4 0.12 255)',
      border: 'oklch(0.73 0.035 250 / 75%)',
      input: 'oklch(0.63 0.04 250)',
      ring: 'oklch(0.47 0.17 255 / 80%)',
      'chart-1': 'oklch(0.6 0.18 255)',
      'chart-2': 'oklch(0.68 0.12 190)',
      'chart-3': 'oklch(0.76 0.13 80)',
      'chart-4': 'oklch(0.64 0.2 5)',
      'chart-5': 'oklch(0.65 0.16 300)',
      radius: '1rem',
      sidebar: 'oklch(1 0 0 / 0.52)',
      'sidebar-foreground': 'oklch(0.3 0.03 255)',
      'sidebar-primary': 'oklch(0.47 0.17 255)',
      'sidebar-primary-foreground': 'oklch(0.99 0 0)',
      'sidebar-accent': 'oklch(0.9 0.04 245 / 70%)',
      'sidebar-accent-foreground': 'oklch(0.4 0.12 255)',
      'sidebar-border': 'oklch(0.8 0.03 250 / 60%)',
      'sidebar-ring': 'oklch(0.47 0.17 255 / 80%)',
      brand: 'oklch(0.47 0.17 255)',
      'brand-2': 'oklch(0.66 0.18 300)',
      'surface-glow': 'oklch(0.58 0.19 255 / 0.18)',
      overlay: 'oklch(0.15 0.03 255 / 0.18)',
    },
    options: {
      effects: ['glass'],
      glass: { material: 'clear', tint: '#f8fbff', blur: 12, opacity: 0.62, rim: 1, lensing: 1.15, brightness: 1, svg: true },
    },
  },
  {
    id: 'liquid-glass-dark',
    name: 'Liquid Glass Oscuro',
    scheme: 'dark',
    version: 1,
    author: 'Qomu',
    license: 'AGPL-3.0',
    description: 'Vidrio oscuro con refracción del contenido en movimiento.',
    tokens: {
      background: 'oklch(0.18 0.02 265)',
      foreground: 'oklch(0.96 0.01 260)',
      card: 'oklch(0.26 0.03 265)',
      'card-foreground': 'oklch(0.96 0.01 260)',
      popover: 'oklch(0.24 0.03 265 / 90%)',
      'popover-foreground': 'oklch(0.96 0.01 260)',
      primary: 'oklch(0.72 0.14 250)',
      'primary-foreground': 'oklch(0.15 0.02 260)',
      secondary: 'oklch(0.3 0.03 265 / 70%)',
      'secondary-foreground': 'oklch(0.94 0.01 260)',
      muted: 'oklch(0.28 0.025 265)',
      'muted-foreground': 'oklch(0.76 0.02 260)',
      accent: 'oklch(0.34 0.05 255)',
      'accent-foreground': 'oklch(0.93 0.03 250)',
      border: 'oklch(1 0 0 / 14%)',
      input: 'oklch(1 0 0 / 18%)',
      ring: 'oklch(0.72 0.14 250 / 60%)',
      'chart-1': 'oklch(0.72 0.14 250)',
      'chart-2': 'oklch(0.74 0.1 190)',
      'chart-3': 'oklch(0.8 0.12 80)',
      'chart-4': 'oklch(0.7 0.17 5)',
      'chart-5': 'oklch(0.7 0.15 300)',
      radius: '1rem',
      sidebar: 'oklch(0.22 0.025 265 / 60%)',
      'sidebar-foreground': 'oklch(0.92 0.01 260)',
      'sidebar-primary': 'oklch(0.72 0.14 250)',
      'sidebar-primary-foreground': 'oklch(0.15 0.02 260)',
      'sidebar-accent': 'oklch(0.3 0.04 260 / 70%)',
      'sidebar-accent-foreground': 'oklch(0.93 0.03 250)',
      'sidebar-border': 'oklch(1 0 0 / 10%)',
      'sidebar-ring': 'oklch(0.72 0.14 250 / 50%)',
      brand: 'oklch(0.72 0.14 250)',
      'brand-2': 'oklch(0.7 0.16 320)',
      'surface-glow': 'oklch(0.72 0.14 250 / 0.22)',
      overlay: 'oklch(0 0 0 / 0.3)',
    },
    options: {
      effects: ['glass'],
      glass: { material: 'clear', blur: 12, opacity: 0.44, rim: 1, lensing: 1.15, brightness: 1, svg: true },
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    scheme: 'dark',
    version: 1,
    author: 'Qomu',
    license: 'AGPL-3.0',
    description: 'Paleta clásica de editor con rosa, verde y amarillo.',
    tokens: {
      background: 'oklch(0.22 0.01 106)',
      foreground: 'oklch(0.96 0.01 106)',
      card: 'oklch(0.26 0.01 106)',
      'card-foreground': 'oklch(0.96 0.01 106)',
      popover: 'oklch(0.28 0.01 106)',
      'popover-foreground': 'oklch(0.96 0.01 106)',
      primary: 'oklch(0.66 0.24 6)',
      'primary-foreground': 'oklch(0.16 0.01 106)',
      secondary: 'oklch(0.31 0.012 106)',
      'secondary-foreground': 'oklch(0.96 0.01 106)',
      muted: 'oklch(0.3 0.01 106)',
      'muted-foreground': 'oklch(0.76 0.02 100)',
      accent: 'oklch(0.34 0.03 106)',
      'accent-foreground': 'oklch(0.88 0.19 96)',
      destructive: 'oklch(0.62 0.24 27)',
      border: 'oklch(1 0 0 / 10%)',
      input: 'oklch(1 0 0 / 14%)',
      ring: 'oklch(0.66 0.24 6 / 60%)',
      'chart-1': 'oklch(0.84 0.21 135)',
      'chart-2': 'oklch(0.76 0.17 55)',
      'chart-3': 'oklch(0.82 0.1 210)',
      'chart-4': 'oklch(0.73 0.16 295)',
      'chart-5': 'oklch(0.88 0.18 96)',
      radius: '0.5rem',
      sidebar: 'oklch(0.2 0.01 106)',
      'sidebar-foreground': 'oklch(0.93 0.01 106)',
      'sidebar-primary': 'oklch(0.66 0.24 6)',
      'sidebar-primary-foreground': 'oklch(0.16 0.01 106)',
      'sidebar-accent': 'oklch(0.3 0.03 106)',
      'sidebar-accent-foreground': 'oklch(0.9 0.05 96)',
      'sidebar-border': 'oklch(1 0 0 / 8%)',
      'sidebar-ring': 'oklch(0.66 0.24 6 / 50%)',
      brand: 'oklch(0.66 0.24 6)',
      'brand-2': 'oklch(0.73 0.16 295)',
      success: 'oklch(0.84 0.21 135)',
      warning: 'oklch(0.88 0.18 96)',
      'surface-glow': 'oklch(0.66 0.24 6 / 0.18)',
      overlay: 'oklch(0 0 0 / 0.25)',
    },
    options: { font: 'geist-mono', effects: ['glow'] },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Oscuro',
    scheme: 'dark',
    version: 1,
    author: 'Qomu',
    license: 'AGPL-3.0',
    description: 'Azules profundos y acentos cálidos del esquema Solarized.',
    tokens: {
      background: 'oklch(0.27 0.04 220)',
      foreground: 'oklch(0.75 0.02 200)',
      card: 'oklch(0.31 0.04 220)',
      'card-foreground': 'oklch(0.82 0.02 200)',
      popover: 'oklch(0.31 0.04 220)',
      'popover-foreground': 'oklch(0.82 0.02 200)',
      primary: 'oklch(0.62 0.13 240)',
      'primary-foreground': 'oklch(0.15 0.02 220)',
      secondary: 'oklch(0.34 0.04 220)',
      'secondary-foreground': 'oklch(0.85 0.02 200)',
      muted: 'oklch(0.33 0.03 220)',
      'muted-foreground': 'oklch(0.68 0.02 200)',
      accent: 'oklch(0.4 0.06 190)',
      'accent-foreground': 'oklch(0.85 0.08 180)',
      destructive: 'oklch(0.6 0.2 30)',
      border: 'oklch(1 0 0 / 10%)',
      input: 'oklch(1 0 0 / 14%)',
      ring: 'oklch(0.62 0.13 240 / 55%)',
      'chart-1': 'oklch(0.62 0.13 240)',
      'chart-2': 'oklch(0.68 0.1 190)',
      'chart-3': 'oklch(0.7 0.15 140)',
      'chart-4': 'oklch(0.75 0.14 80)',
      'chart-5': 'oklch(0.62 0.18 330)',
      radius: '0.375rem',
      sidebar: 'oklch(0.24 0.04 220)',
      'sidebar-foreground': 'oklch(0.78 0.02 200)',
      'sidebar-primary': 'oklch(0.62 0.13 240)',
      'sidebar-primary-foreground': 'oklch(0.15 0.02 220)',
      'sidebar-accent': 'oklch(0.33 0.05 220)',
      'sidebar-accent-foreground': 'oklch(0.85 0.06 180)',
      'sidebar-border': 'oklch(1 0 0 / 8%)',
      'sidebar-ring': 'oklch(0.62 0.13 240 / 50%)',
      brand: 'oklch(0.62 0.13 240)',
      'brand-2': 'oklch(0.68 0.1 190)',
      success: 'oklch(0.7 0.15 140)',
      warning: 'oklch(0.75 0.14 80)',
      'surface-glow': 'oklch(0.62 0.13 240 / 0.2)',
      overlay: 'oklch(0 0 0 / 0.25)',
    },
    options: { font: 'geist-mono' },
  },
]

export const BUILTIN_THEMES: Theme[] = BUILTIN_INPUTS.map(resolveTheme)
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
  return readStorage().map(resolveTheme)
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
