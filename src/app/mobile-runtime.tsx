import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Unsubscribe } from '@/domain/ports'
import { useAuth, useContainer } from './auth-provider'
import { useTheme } from './theme-provider'

function isNativeRuntime(): boolean {
  const capacitor = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean }
  }).Capacitor
  return Boolean(capacitor?.isNativePlatform?.())
}

/**
 * Ciclo de vida nativo: registro del dispositivo, deep links y botón atrás.
 * En web es un componente inerte.
 */
export function MobileRuntime() {
  const container = useContainer()
  const { status, session } = useAuth()
  const { resolvedTheme } = useTheme()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const gateway = container.pushGateway

  useEffect(() => {
    if (!isNativeRuntime()) return
    void import('@capacitor/status-bar')
      .then(({ StatusBar, Style }) => {
        const dark = resolvedTheme === 'dark'
        void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
        void StatusBar.setBackgroundColor({
          color: dark ? '#0c0b12' : '#fbfaff',
        }).catch(() => {})
      })
      .catch(() => {})
  }, [resolvedTheme])

  useEffect(() => {
    if (!isNativeRuntime()) return
    void import('@/infrastructure/capacitor/mobile-shell').then(({ startMobileShell }) => {
      // El shell vive durante toda la app; no se retira al re-renderizar.
      void startMobileShell({ onDeepLink: (path) => navigateRef.current(path) })
    })
  }, [])

  useEffect(() => {
    if (!gateway.isSupported()) return
    return gateway.onNotificationTap((path) => navigateRef.current(path))
  }, [gateway])

  useEffect(() => {
    if (status !== 'authenticated' || !session || !gateway.isSupported()) return
    let disposed = false
    const unsubscribers: Unsubscribe[] = []

    const setup = async () => {
      await gateway.initialize()
      if (disposed) return
      unsubscribers.push(
        gateway.onToken((token) => {
          if (disposed) return
          void gateway
            .appVersion()
            .then((appVersion) => {
              if (disposed) return
              return container.devices.register(session.id, {
                id: gateway.deviceId(),
                token,
                platform: gateway.platform(),
                appVersion,
              })
            })
            .catch((error) => console.warn('[openqomu] no se pudo guardar el token push', error))
        }),
      )

      const current = await gateway.permission().catch(() => ({ status: 'prompt' as const }))
      const next =
        current.status === 'prompt'
          ? await gateway.requestPermission().catch(() => ({ status: 'denied' as const }))
          : current
      if (disposed || next.status !== 'granted') return

      const registered = await container.devices
        .get(session.id, gateway.deviceId())
        .catch(() => null)
      // Si el usuario desactivó las notificaciones, no volvemos a registrar.
      if (registered && !registered.enabled) return
      await gateway.register()
    }

    void setup().catch((error) => console.warn('[openqomu] push setup', error))

    return () => {
      disposed = true
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [container, gateway, session, status])

  return null
}
