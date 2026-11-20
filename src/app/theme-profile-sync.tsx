import { useEffect, useRef } from 'react'
import { useAuth, useContainer } from './auth-provider'
import { useTheme } from './theme-provider'
import { DEFAULT_THEME_ID } from './theme/registry'

/**
 * Replica el tema del perfil entre dispositivos. El proveedor sigue siendo la
 * fuente local; este puente solo resuelve el id remoto.
 */
export function ThemeProfileSync() {
  const { profile } = useAuth()
  const container = useContainer()
  const { theme, themes, packagesReady, setTheme } = useTheme()
  const seenRemote = useRef<string | null | undefined>(undefined)
  const adoptedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!profile) {
      seenRemote.current = undefined
      adoptedFor.current = null
      return
    }
    if (!packagesReady) return
    const remote = profile.themeId ?? null
    if (remote === seenRemote.current) return
    seenRemote.current = remote

    if (remote) {
      if (themes.some(({ id }) => id === remote)) {
        if (remote !== theme.id) setTheme(remote)
      } else {
        if (theme.id !== DEFAULT_THEME_ID) setTheme(DEFAULT_THEME_ID)
      }
      return
    }
    if (adoptedFor.current === profile.id) return
    adoptedFor.current = profile.id
    void container.users.updateProfile(profile.id, { themeId: theme.id }).catch(() => {})
  }, [container, packagesReady, profile, setTheme, theme.id, themes])

  return null
}
