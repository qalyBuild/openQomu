import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { applyTheme, readThemeCache } from './theme/apply'
import {
  BUILTIN_THEMES,
  OFFICIAL_THEME_PACKAGES,
  isBuiltinTheme,
  findTheme,
  installTheme as installStoredTheme,
  loadInstalledThemes,
  removeTheme as removeStoredTheme,
  DEFAULT_THEME_ID,
} from './theme/registry'
import { deleteThemePackage, loadThemePackages, storeThemePackage } from './theme/package-store'
import { resolvePackageThemes, type ThemePackage, type ThemePackageGroup } from './theme/theme-package'
import type { Theme, ThemeInput, ThemeScheme } from './theme/tokens'

interface ThemeContextValue {
  theme: Theme
  themes: Theme[]
  scheme: ThemeScheme
  packages: ThemePackage[]
  packageGroups: ThemePackageGroup[]
  packagesReady: boolean
  setTheme: (id: string) => void
  install: (input: ThemeInput) => Theme
  remove: (id: string) => boolean
  installPackage: (item: ThemePackage, variantId: string) => Promise<void>
  removePackage: (id: string) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'openqomu.theme.id'
const LEGACY_STORAGE_KEY = 'openqomu.theme'
const defaultTheme = BUILTIN_THEMES.find(({ id }) => id === DEFAULT_THEME_ID)!

function persist(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Sin almacenamiento, la elección dura la sesión.
  }
}

function initialSelection(): string {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      persist(legacy === 'light' ? 'qomu-light' : DEFAULT_THEME_ID)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [selectedId, select] = useState(initialSelection)
  const [installed, setInstalled] = useState(loadInstalledThemes)
  const [packages, setPackages] = useState<ThemePackage[]>([])
  const [storageStatus, setStorageStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const packagesReady = storageStatus !== 'loading'

  useEffect(() => {
    let mounted = true
    void loadThemePackages().then((stored) => {
      if (!mounted) return
      setPackages(stored.filter((item) =>
        !OFFICIAL_THEME_PACKAGES.some(({ manifest }) => manifest.id === item.manifest.id)
        && !item.themes.some(({ id }) => isBuiltinTheme(id))))
      setStorageStatus('ready')
    }, () => {
      if (mounted) setStorageStatus('unavailable')
    })
    return () => { mounted = false }
  }, [])

  const packageGroups = useMemo(() => packages.map((item) => ({
    manifest: item.manifest,
    themes: resolvePackageThemes(item),
  })), [packages])
  const themes = useMemo(() => {
    const packaged = packageGroups.flatMap((group) => group.themes)
    const ids = new Set(packaged.map(({ id }) => id))
    return [...BUILTIN_THEMES, ...packaged, ...installed.filter(({ id }) => !ids.has(id))]
  }, [installed, packageGroups])
  const selected = themes.find(({ id }) => id === selectedId)
  const theme = selected ?? defaultTheme

  useLayoutEffect(() => {
    if (!selected && !packagesReady && readThemeCache()?.id === selectedId) return
    applyTheme(theme)
    if (selected || storageStatus === 'ready') persist(theme.id)
  }, [packagesReady, selected, selectedId, storageStatus, theme])

  const setTheme = useCallback((id: string) => {
    select(themes.some((item) => item.id === id) || findTheme(id) ? id : DEFAULT_THEME_ID)
  }, [themes])

  const install = useCallback((input: ThemeInput) => {
    if (packages.some((item) => item.themes.some(({ id }) => id === input.id))) {
      throw new Error('La variante pertenece a un paquete instalado.')
    }
    const next = installStoredTheme(input)
    setInstalled(loadInstalledThemes())
    return next
  }, [packages])

  const remove = useCallback((id: string) => {
    const removed = removeStoredTheme(id)
    if (!removed) return false
    setInstalled(loadInstalledThemes())
    select((current) => current === id ? DEFAULT_THEME_ID : current)
    return true
  }, [])

  const installPackage = useCallback(async (item: ThemePackage, variantId: string) => {
    if (OFFICIAL_THEME_PACKAGES.some(({ manifest }) => manifest.id === item.manifest.id)
      || item.themes.some(({ id }) => isBuiltinTheme(id))) {
      throw new Error('No se puede sobrescribir un paquete o variante oficial.')
    }
    if (!item.themes.some(({ id }) => id === variantId)) throw new Error('La variante no existe en el paquete.')
    await storeThemePackage(item)
    setPackages((current) => [...current.filter(({ manifest }) => manifest.id !== item.manifest.id), item])
    select(variantId)
  }, [])

  const removePackage = useCallback(async (id: string) => {
    const item = packages.find(({ manifest }) => manifest.id === id)
    if (!item) return
    await deleteThemePackage(id)
    setPackages((current) => current.filter(({ manifest }) => manifest.id !== id))
    select((current) => item.themes.some((variant) => variant.id === current) ? DEFAULT_THEME_ID : current)
  }, [packages])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themes, scheme: theme.scheme, packages, packageGroups, packagesReady,
      setTheme, install, remove, installPackage, removePackage }),
    [theme, themes, packages, packageGroups, packagesReady, setTheme, install, remove, installPackage, removePackage],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme debe usarse dentro de <ThemeProvider>.')
  return context
}
