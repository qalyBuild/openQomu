import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar } from '@capacitor/status-bar'
import { publicAppOrigin } from '@/lib/app-url'

export interface MobileShellHandlers {
  onDeepLink: (path: string) => void
}

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/** Hosts que la app nativa acepta como App Links. */
export function appLinkHosts(): Set<string> {
  const hosts = new Set<string>()
  const configured = import.meta.env.VITE_APP_LINK_HOSTS ?? ''
  for (const value of configured.split(',')) {
    const host = value.trim()
    if (host) hosts.add(host)
  }
  try {
    hosts.add(new URL(publicAppOrigin()).host)
  } catch {
    // Sin origen público (por ejemplo en tests) solo valen los hosts configurados.
  }
  return hosts
}

/** Convierte un deep link de Android en una ruta interna de React Router. */
export function pathFromDeepLink(url: string, hosts: Set<string> = appLinkHosts()): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'openqomu:') {
      const path = `/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(
        /\/+$/,
        '',
      )
      return path.startsWith('/w/') || path.startsWith('/join/') || path === '/app' || path === '/onboarding'
        ? path
        : null
    }
    if (!hosts.has(parsed.host)) return null
    if (
      parsed.pathname.startsWith('/w/') ||
      parsed.pathname.startsWith('/join/') ||
      parsed.pathname === '/app'
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return null
  } catch {
    return null
  }
}

function hasOpenOverlay(): boolean {
  return Boolean(
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"], [data-slot="sheet-content"], [cmdk-dialog]',
    ),
  )
}

function closeOverlay(): boolean {
  if (!hasOpenOverlay()) return false
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
  })
  const target = document.activeElement instanceof Element ? document.activeElement : document.body
  target.dispatchEvent(event)
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  )
  return true
}

/**
 * Configura la apariencia nativa y los botones del sistema.
 * Es idempotente: los listeners se registran una sola vez por proceso.
 */
export function startMobileShell(handlers: MobileShellHandlers): Promise<() => void> {
  if (!isNativeAndroid()) return Promise.resolve(() => {})
  shellPromise ??= bootMobileShell(handlers)
  return shellPromise
}

let shellPromise: Promise<() => void> | null = null

async function bootMobileShell(handlers: MobileShellHandlers): Promise<() => void> {
  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
  await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {})
  await SplashScreen.hide().catch(() => {})

  const urlListener = await App.addListener('appUrlOpen', ({ url }) => {
    const path = pathFromDeepLink(url)
    if (path) {
      if (closeOverlay()) window.setTimeout(() => handlers.onDeepLink(path), 120)
      else handlers.onDeepLink(path)
    }
  })

  const backListener = await App.addListener('backButton', () => {
    if (closeOverlay()) return
    const canGoBack = window.history.length > 1
    if (canGoBack) {
      window.history.back()
      return
    }
    void App.exitApp()
  })

  // Arranque en frío desde un App Link.
  const launch = await App.getLaunchUrl().catch(() => null)
  if (launch?.url) {
    const path = pathFromDeepLink(launch.url)
    if (path) handlers.onDeepLink(path)
  }

  const onDocumentClick = (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement | null)?.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href) return
    try {
      const url = new URL(href, window.location.href)
      const external = url.origin !== window.location.origin
      if (external && (url.protocol === 'http:' || url.protocol === 'https:')) {
        event.preventDefault()
        void Browser.open({ url: url.toString() })
      }
    } catch {
      // Enlaces no parseables: deja el comportamiento nativo.
    }
  }
  document.addEventListener('click', onDocumentClick)

  return () => {
    document.removeEventListener('click', onDocumentClick)
    void urlListener.remove()
    void backListener.remove()
  }
}
