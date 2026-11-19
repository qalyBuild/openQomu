import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { registerPlugin } from '@capacitor/core'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/domain/services/file-service'
import { isNativeApp, publicApkUrl } from '@/lib/app-url'
import { isVersionNewer } from '@/lib/version'
import { cn } from '@/lib/utils'

interface ApkInstallerPlugin {
  install(options: { url: string }): Promise<void>
}

/** Plugin nativo: descarga la APK y abre el instalador de Android. */
const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller')

interface ApkManifest {
  version?: string
  size?: number
  builtAt?: string
  sha256?: string
}

function formatManifestDate(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

/** Descarga de la APK interna publicada junto a la web. */
export function AppDownload() {
  const [manifest, setManifest] = useState<ApkManifest | null>(null)
  const [installedVersion, setInstalledVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const retryPending = useRef(false)
  const apkUrl = publicApkUrl()
  const manifestUrl = apkUrl.replace(/[^/]+$/, 'latest.json')

  useEffect(() => {
    if (!apkUrl || !isNativeApp()) return
    let cancelled = false
    void import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => {
        if (!cancelled) setInstalledVersion(info.version)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!apkUrl) {
      setLoading(false)
      return
    }
    let cancelled = false
    fetch(manifestUrl, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ApkManifest | null) => {
        if (!cancelled) setManifest(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apkUrl, manifestUrl])

  const latestVersion = manifest?.version
  const updateAvailable = Boolean(
    installedVersion && latestVersion && isVersionNewer(latestVersion, installedVersion),
  )

  const install = useCallback(async () => {
    if (!isNativeApp()) {
      window.open(apkUrl, '_blank', 'noopener')
      return
    }
    setInstalling(true)
    try {
      await ApkInstaller.install({ url: apkUrl })
      retryPending.current = false
      toast.success('Descarga completada. Confirma la instalación en Android.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo iniciar la instalación.'
      // El plugin abre los ajustes de «apps desconocidas»: reintentamos al volver.
      if (/desconocidas|permiso/i.test(message)) {
        retryPending.current = true
        toast.info('Activa «Instalar apps desconocidas» y vuelve: reintentaremos solos.')
      } else {
        toast.error(message)
      }
    } finally {
      setInstalling(false)
    }
  }, [apkUrl])

  useEffect(() => {
    if (!apkUrl || !isNativeApp()) return
    let remove: (() => void) | undefined
    let cancelled = false
    void import('@capacitor/app').then(({ App }) => {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive || !retryPending.current) return
        retryPending.current = false
        void install()
      }).then((handle) => {
        if (cancelled) void handle.remove()
        else remove = () => void handle.remove()
      })
    })
    return () => {
      cancelled = true
      remove?.()
    }
  }, [install])

  if (!apkUrl) return null

  return (
    <div data-glass-surface="panel" className="rounded-2xl border bg-card/60 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background text-primary">
          <Smartphone className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            App Android
            <span className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-wider text-primary">
              Interna
            </span>
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Descarga la última versión de openQomu para Android. Al actualizar se conservan tu sesión
            y tus datos.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ['Versión', manifest?.version ?? '1.0.0'],
          ['Publicada', formatManifestDate(manifest?.builtAt)],
          ['Tamaño', loading ? '—' : manifest?.size ? formatBytes(manifest.size) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border bg-background/40 px-3 py-2.5">
            <p className="text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/70">
              {label}
            </p>
            <p className="mt-1 truncate text-xs font-medium">{value}</p>
          </div>
        ))}
      </div>

      {installedVersion && latestVersion && (
        <p
          className={cn(
            'mt-4 text-[0.68rem] leading-relaxed',
            updateAvailable
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {updateAvailable
            ? `Hay una versión nueva: tienes la ${installedVersion}.`
            : `Tienes la última versión (${installedVersion}).`}
        </p>
      )}

      <Button className="mt-3 w-full gap-2 sm:w-auto" onClick={() => void install()} disabled={installing}>
        {installing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : updateAvailable ? (
          <RefreshCw className="size-4" />
        ) : (
          <Download className="size-4" />
        )}
        {installing ? 'Descargando…' : updateAvailable ? 'Actualizar APK' : 'Descargar APK'}
      </Button>

      <p className="mt-3 flex items-start gap-1.5 text-[0.65rem] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
        Instalación interna. Android pedirá permiso para instalar apps de orígenes desconocidos la
        primera vez.
      </p>
    </div>
  )
}
