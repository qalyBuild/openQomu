import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { applyTheme } from './theme/apply'
import {
  BUILTIN_THEMES,
  findTheme,
  installTheme as installStoredTheme,
  loadInstalledThemes,
  removeTheme as removeStoredTheme,
  DEFAULT_THEME_ID,
} from './theme/registry'
import type { Theme, ThemeInput, ThemeScheme } from './theme/tokens'

interface ThemeContextValue {
  theme: Theme
  themes: Theme[]
  scheme: ThemeScheme
  setTheme: (id: string) => void
  install: (input: ThemeInput) => Theme
  remove: (id: string) => boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'openqomu.theme.id'
const LEGACY_STORAGE_KEY = 'openqomu.theme'

function persist(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Sin almacenamiento: la elección dura la sesión.
  }
}

function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return
    localStorage.setItem(STORAGE_KEY, legacy === 'light' ? 'qomu-light' : DEFAULT_THEME_ID)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Sin almacenamiento.
  }
}

function storedThemeId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function initialTheme(): Theme {
  migrateLegacy()
  const stored = storedThemeId()
  const theme = (stored ? findTheme(stored) : undefined) ?? findTheme(DEFAULT_THEME_ID)!
  persist(theme.id)
  return applyTheme(theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [installed, setInstalled] = useState<Theme[]>(loadInstalledThemes)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((id: string) => {
    const next = findTheme(id) ?? findTheme(DEFAULT_THEME_ID)!
    persist(next.id)
    applyTheme(next)
    setThemeState(next)
  }, [])

  const install = useCallback((input: ThemeInput) => {
    const next = installStoredTheme(input)
    setInstalled(loadInstalledThemes())
    return next
  }, [])

  const remove = useCallback(
    (id: string) => {
      const removed = removeStoredTheme(id)
      if (!removed) return false
      setInstalled(loadInstalledThemes())
      if (theme.id === id) {
        setTheme(DEFAULT_THEME_ID)
      }
      return true
    },
    [setTheme, theme.id],
  )

  const themes = useMemo(() => [...BUILTIN_THEMES, ...installed], [installed])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themes, scheme: theme.scheme, setTheme, install, remove }),
    [theme, themes, setTheme, install, remove],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme debe usarse dentro de <ThemeProvider>.')
  return context
}
