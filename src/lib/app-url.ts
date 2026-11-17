/** Origen público de la web, incluso dentro de la app nativa. */
export function isNativeApp(): boolean {
  const capacitor = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean }
  }).Capacitor
  return Boolean(capacitor?.isNativePlatform?.())
}

/**
 * En el APK, `window.location.origin` es `https://localhost`, que no sirve
 * para compartir enlaces. La app nativa exige `VITE_PUBLIC_APP_URL`.
 */
export function publicAppOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return window.location.origin
}

/** URL pública de la última APK. Vacía si la instancia no publica binarios. */
export function publicApkUrl(): string {
  return import.meta.env.VITE_APK_URL?.trim() ?? ''
}

/**
 * URL pública de la app, incluido el subdirectorio base (GitHub Pages).
 * Se pasa a la landing para que su botón «Entrar» vuelva a esta instancia.
 */
export function publicAppUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${publicAppOrigin()}${base}`.replace(/\/$/, '')
}

const DEFAULT_LANDING_URL = 'https://openqomu.qaly.dev'

/** Landing estática externa. */
export function publicLandingUrl(): string {
  const configured = import.meta.env.VITE_LANDING_URL?.trim()
  return (configured || DEFAULT_LANDING_URL).replace(/\/$/, '')
}
