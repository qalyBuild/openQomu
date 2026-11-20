import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Download, ExternalLink, Loader2, Moon, Package, Palette, RefreshCw, Sun, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useTheme } from '@/app/theme-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { DEFAULT_THEME_ID, OFFICIAL_THEME_PACKAGES, isBuiltinTheme, fetchCatalog } from '@/app/theme/registry'
import { parseThemeFile, MAX_THEME_BYTES } from '@/app/theme/validate'
import { getOfficialThemePackage } from '@/app/theme/official-packages'
import { fetchCatalogPackage, fetchPackageCatalog, type CatalogThemePackage } from '@/app/theme/package-catalog'
import { MAX_PACKAGE_BYTES, parseThemePackage, resolvePackageThemes, serializeThemePackage, singleThemePackage, themePackageFilename, type ThemePackage, type ThemePackageGroup } from '@/app/theme/theme-package'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { downloadBlobFile } from '@/lib/zip'
import { resolveTheme, type Theme, type ThemeInput } from '@/app/theme/tokens'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'light' | 'dark'
const ENABLE_CONTRIBUTIONS = true
const CONTRIBUTE_GUIDE = 'https://github.com/qalyBuild/openQomu/blob/main/themes/README.md'
const CONTRIBUTE_FORK = 'https://github.com/qalyBuild/openQomu/fork'

function downloadPackage(item: ThemePackage, contribution = false) {
  const { id } = item.manifest
  const bytes = serializeThemePackage(item.files, contribution ? `themes/community/${id}/` : '')
  downloadBlobFile(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }),
    contribution ? `${id}-contribucion.zip` : themePackageFilename(item.manifest))
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo procesar el tema.'
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'light', label: 'Claros' },
  { value: 'dark', label: 'Oscuros' },
]

function ThemePreview({ theme }: { theme: Theme }) {
  const t = theme.tokens
  const preview = useRef<HTMLDivElement>(null)
  const { wallpaper } = theme
  useEffect(() => {
    const element = preview.current
    if (!element || !wallpaper) return
    const blob = typeof wallpaper !== 'string'
    if (blob && typeof URL.createObjectURL !== 'function') return
    const url = blob ? URL.createObjectURL(wallpaper) : wallpaper
    element.style.backgroundImage = `url(${JSON.stringify(url)})`
    return () => {
      element.style.removeProperty('background-image')
      if (blob) URL.revokeObjectURL(url)
    }
  }, [wallpaper])
  return (
    <div
      ref={preview}
      aria-hidden="true"
      className="flex h-36 gap-2 border-b bg-cover bg-center p-3"
      style={{ backgroundColor: t.background, color: t.foreground, borderColor: t.border }}
    >
      <div
        className="flex w-1/4 flex-col gap-1.5 rounded-lg border p-2"
        style={{ background: t.sidebar, borderColor: t['sidebar-border'] }}
      >
        <div className="h-2 w-8 rounded" style={{ background: t['sidebar-primary'] }} />
        <div className="h-1.5 w-full rounded" style={{ background: t['sidebar-accent'] }} />
        <div className="h-1.5 w-3/4 rounded" style={{ background: t['sidebar-accent'] }} />
      </div>
      <div
        className="flex flex-1 flex-col gap-2 rounded-lg border p-2"
        style={{ background: t.card, borderColor: t.border }}
      >
        <div className="h-2 w-1/2 rounded" style={{ background: t['card-foreground'], opacity: 0.85 }} />
        <div className="h-1.5 w-3/4 rounded" style={{ background: t['muted-foreground'], opacity: 0.6 }} />
        <div className="mt-auto flex items-center gap-1">
          {(['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const).map((token) => (
            <span
              key={token}
              className="size-3 rounded-full"
              style={{ background: t[token] }}
            />
          ))}
          <span
            className="ms-auto rounded-full px-2 py-1 text-[0.6rem] font-medium"
            style={{ background: t.primary, color: t['primary-foreground'] }}
          >
            Aplicar
          </span>
        </div>
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  active,
  onApply,
  applyLabel = 'Aplicar',
  onExport,
  onRemove,
}: {
  theme: Theme
  active: boolean
  onApply: () => void
  applyLabel?: string
  onExport?: () => void
  onRemove?: () => void
}) {
  return (
    <div
      data-theme-id={theme.id}
      data-glass-surface="panel"
      className={cn(
        'overflow-hidden rounded-xl border bg-card text-start transition-colors',
        active ? 'border-primary/60 ring-1 ring-primary/30' : 'hover:border-border',
      )}
    >
      <ThemePreview theme={theme} />
      <div className="flex items-center gap-2 p-3">
        {theme.scheme === 'dark' ? (
          <Moon className="size-3.5 text-muted-foreground" />
        ) : (
          <Sun className="size-3.5 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{theme.name}</p>
          <p className="truncate text-[0.62rem] text-muted-foreground">
            {theme.author}
            {theme.options.effects.length > 0 && ` · ${theme.options.effects.join(', ')}`}
          </p>
        </div>
        <Badge variant="outline" className="text-[0.58rem]">
          {theme.scheme === 'dark' ? 'Oscuro' : 'Claro'}
        </Badge>
        {active ? (
          <Badge className="gap-1 text-[0.58rem]">
            <Check className="size-3" /> Activo
          </Badge>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-[0.65rem]" onClick={onApply}>
            {applyLabel}
          </Button>
        )}
      </div>
      {(onExport || onRemove) && <div className="flex items-center gap-1 border-t px-3 py-2">
        {onExport && <Button variant="ghost" size="sm" className="h-7 gap-1 text-[0.65rem]" onClick={onExport}>
          <Download className="size-3" /> Exportar paquete
        </Button>}
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[0.65rem] text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-3" /> Eliminar
          </Button>
        )}
      </div>}
    </div>
  )
}

function PackageSection({ group, filter, actions, children }: {
  group: ThemePackageGroup
  filter: Filter
  actions: ReactNode
  children: (theme: Theme) => ReactNode
}) {
  const visible = group.themes.filter(({ scheme }) => filter === 'all' || scheme === filter)
  if (!visible.length) return null
  return (
    <article className="space-y-3 rounded-2xl border bg-card/60 p-4 sm:p-5" data-theme-package={group.manifest.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">{group.manifest.name}</h3>
            <p className="text-xs text-muted-foreground">{group.manifest.author} · v{group.manifest.version}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {group.manifest.description && <p className="text-xs text-muted-foreground">{group.manifest.description}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map(children)}</div>
    </article>
  )
}

function PackagePreviewDialog({ item, mode, busy, close, onInstall }: {
  item: ThemePackage
  mode: 'install' | 'contribute'
  busy: boolean
  close: () => void
  onInstall: (id: string) => void
}) {
  const previews = useMemo(() => resolvePackageThemes(item), [item])
  const [variantId, setVariantId] = useState(previews[0].id)
  const { id, name, author, license, version } = item.manifest
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) close() }}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{mode === 'install' ? 'Instalar paquete' : 'Contribuir con un tema'}</DialogTitle>
          <DialogDescription>{name} · {author} · v{version} · {license}</DialogDescription>
        </DialogHeader>
        {mode === 'install' && (
          <p className="text-sm">Se guardarán todas las variantes. Elige cuál quieres aplicar.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {previews.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-xl border">
              <ThemePreview theme={item} />
              {mode === 'install' ? (
                <label className="flex items-center gap-2 p-3 text-xs">
                  <input type="radio" name="theme-variant" checked={variantId === item.id}
                    disabled={busy} onChange={() => setVariantId(item.id)} />
                  {item.name}
                </label>
              ) : <p className="p-3 text-xs">{item.name}</p>}
            </div>
          ))}
        </div>
        {mode === 'contribute' && (
          <div className="space-y-2 rounded-xl bg-muted/60 p-3 text-sm">
            <p>El paquete es válido. Descarga los archivos y abre GitHub para crear tu copia de openQomu.</p>
            <p>Extrae el ZIP en la raíz de tu copia. Sube <code className="break-all">themes/community/{id}/</code> y abre un PR a <code>main</code> desde GitHub.</p>
            <a className="text-primary underline" href={CONTRIBUTE_GUIDE} target="_blank" rel="noreferrer">
              Ver guía de contribución
            </a>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Cerrar</Button>
          {mode === 'contribute' ? (
            <Button asChild>
              <a href={CONTRIBUTE_FORK} target="_blank" rel="noreferrer" onClick={() => downloadPackage(item, true)}>
                Descargar y abrir GitHub <ExternalLink />
              </a>
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => onInstall(variantId)}>
              {busy ? 'Instalando…' : 'Instalar y aplicar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ThemesPage() {
  const { uid } = useWorkspaceData()
  const { session } = useAuth()
  const container = useContainer()
  const { theme, themes, packages, packageGroups, packagesReady, setTheme, install, remove, installPackage, removePackage } = useTheme()
  const [filter, setFilter] = useState<Filter>('all')
  const [catalog, setCatalog] = useState<{ packages: CatalogThemePackage[]; legacy: ThemeInput[] } | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [contributing, setContributing] = useState(false)
  const [pending, setPending] = useState<{ item: ThemePackage; mode: 'install' | 'contribute' }>()
  const fileInput = useRef<HTMLInputElement>(null)
  const contributionInput = useRef<HTMLInputElement>(null)

  const packagedIds = new Set(packageGroups.flatMap(({ themes }) => themes.map(({ id }) => id)))
  const legacy = themes.filter((item) => !isBuiltinTheme(item.id) && !packagedIds.has(item.id) && (filter === 'all' || item.scheme === filter))
  const published = (catalog?.packages ?? []).filter((entry) =>
    entry.category === 'community' && !packages.some((installed) => installed.manifest.id === entry.manifest.id
      && installed.manifest.version >= entry.manifest.version)
    && entry.themes.some((variant) => filter === 'all' || variant.scheme === filter))

  function saveSelection(id: string) {
    if (session) {
      void container.users.updateProfile(uid, { themeId: id }).catch(() => {
        toast.error('El tema se aplicó, pero no se pudo guardar en tu perfil.')
      })
    }
  }

  function apply(id: string) {
    setTheme(id)
    saveSelection(id)
  }

  async function prepareFile(file: File, mode: 'install' | 'contribute') {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'install' && file.name.toLowerCase().endsWith('.json')) {
        if (file.size > MAX_THEME_BYTES) throw new Error('El tema supera 32 KiB.')
        const result = parseThemeFile(await file.text())
        if (!result.ok) throw new Error(result.errors.join(' '))
        install(result.value)
        // La instalación actualiza el registro en el mismo almacenamiento.
        setTheme(result.value.id)
        saveSelection(result.value.id)
        toast.success(`Tema «${result.value.name}» instalado.`)
        return
      }
      if (file.size > MAX_PACKAGE_BYTES) throw new Error('El paquete supera 8 MiB.')
      const item = parseThemePackage(new Uint8Array(await file.arrayBuffer()))
      if (mode === 'contribute') {
        if (item.manifest.license !== 'CC0-1.0') throw new Error('Los paquetes de la comunidad deben usar CC0-1.0.')
        if (OFFICIAL_THEME_PACKAGES.some(({ manifest }) => manifest.id === item.manifest.id)
          || item.themes.some(({ id }) => isBuiltinTheme(id))) {
          throw new Error('Usa un ID de paquete y de variantes distinto de los oficiales.')
        }
      }
      setContributing(false)
      setPending({ item, mode })
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }

  async function installPending(id: string) {
    if (!pending || busy || !packagesReady) return
    setBusy(true)
    try {
      await installPackage(pending.item, id)
      saveSelection(id)
      toast.success(`Paquete «${pending.item.manifest.name}» instalado.`)
      setPending(undefined)
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  async function loadCatalog() {
    setLoadingCatalog(true)
    try {
      setCatalog({ packages: await fetchPackageCatalog(), legacy: [] })
    } catch {
      const legacy = await fetchCatalog()
      setCatalog({ packages: [], legacy })
      if (legacy.length === 0) toast.error('No se pudo cargar el catálogo de temas.')
    } finally {
      setLoadingCatalog(false)
    }
  }

  async function catalogAction(entry: CatalogThemePackage, action: 'preview' | 'export') {
    if (busy) return
    setBusy(true)
    try {
      const item = await fetchCatalogPackage(entry)
      if (action === 'export') downloadPackage(item)
      else setPending({ item, mode: 'install' })
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  async function uninstallPackage(group: ThemePackageGroup) {
    if (busy) return
    setBusy(true)
    try {
      await removePackage(group.manifest.id)
      if (group.themes.some(({ id }) => id === theme.id)) saveSelection(DEFAULT_THEME_ID)
      toast.success(`Paquete «${group.manifest.name}» eliminado.`)
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  function exportSingle(item: Theme) {
    try {
      const { wallpaper: _wallpaper, ...input } = item
      downloadPackage(singleThemePackage(input))
    } catch (error) {
      toast.error(message(error))
    }
  }

  const availableLegacy = (catalog?.legacy ?? []).filter((item) =>
    !themes.some(({ id }) => id === item.id) && (filter === 'all' || item.scheme === filter))

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-5 pb-12 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Palette className="size-5" /> Temas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Tema activo · <strong>{theme.name}</strong></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileInput} type="file" accept=".qomutheme,.zip,.json,application/json"
              className="hidden" onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void prepareFile(file, 'install')
              }} />
            <Button variant="outline" size="sm" disabled={!packagesReady || busy} onClick={() => fileInput.current?.click()}>
              <Upload /> Importar
            </Button>
            {ENABLE_CONTRIBUTIONS && (
              <Button size="sm" disabled={busy} onClick={() => { setError(''); setContributing(true) }}>
                Contribuir con un tema
              </Button>
            )}
          </div>
        </header>

        {error && !contributing && <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <Button key={option.value} size="sm" aria-pressed={filter === option.value}
              variant={filter === option.value ? 'secondary' : 'ghost'} onClick={() => setFilter(option.value)}>
              {option.label}
            </Button>
          ))}
        </div>

        <section className="space-y-3" aria-labelledby="official-theme-heading">
          <h2 id="official-theme-heading" className="text-sm font-semibold">Paquetes oficiales</h2>
          {OFFICIAL_THEME_PACKAGES.map((group) => (
            <PackageSection key={group.manifest.id} group={group} filter={filter} actions={
              <Button variant="outline" size="sm"
                onClick={() => void getOfficialThemePackage(group.manifest.id).then(
                  (item) => downloadPackage(item), (error) => toast.error(message(error)))}>
                <Download /> Exportar paquete
              </Button>
            }>{(item) => (
              <ThemeCard key={item.id} theme={item} active={item.id === theme.id} onApply={() => apply(item.id)} />
            )}</PackageSection>
          ))}
        </section>

        {(packageGroups.length > 0 || legacy.length > 0) && (
          <section className="space-y-3" aria-labelledby="installed-theme-heading">
            <h2 id="installed-theme-heading" className="text-sm font-semibold">Instalados</h2>
            {packageGroups.map((group) => (
              <PackageSection key={group.manifest.id} group={group} filter={filter} actions={<>
                <Button variant="outline" size="sm" onClick={() => {
                  const item = packages.find(({ manifest }) => manifest.id === group.manifest.id)
                  if (item) downloadPackage(item)
                }}><Download /> Exportar paquete</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void uninstallPackage(group)}>
                  <Trash2 /> Eliminar paquete
                </Button>
              </>}>{(item) => (
                <ThemeCard key={item.id} theme={item} active={item.id === theme.id} onApply={() => apply(item.id)} />
              )}</PackageSection>
            ))}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {legacy.map((item) => (
                <ThemeCard key={item.id} theme={item} active={item.id === theme.id}
                  onApply={() => apply(item.id)} onExport={() => exportSingle(item)}
                  onRemove={() => {
                    if (remove(item.id) && item.id === theme.id) saveSelection(DEFAULT_THEME_ID)
                  }} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3" aria-labelledby="community-theme-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="community-theme-heading" className="text-sm font-semibold">Comunidad</h2>
            <Button variant="outline" size="sm" disabled={loadingCatalog} onClick={() => void loadCatalog()}>
              {loadingCatalog ? <Loader2 className="animate-spin" /> : catalog ? <RefreshCw /> : <Palette />}
              {catalog ? 'Actualizar catálogo' : 'Explorar catálogo'}
            </Button>
          </div>
          {published.map((entry) => {
            const group = { manifest: entry.manifest, themes: entry.themes.map((input) => resolveTheme(input)) }
            const preview = () => void catalogAction(entry, 'preview')
            return (
              <PackageSection key={entry.manifest.id} group={group} filter={filter} actions={
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void catalogAction(entry, 'export')}>
                  <Download /> Descargar paquete
                </Button>
              }>{(item) => (
                <ThemeCard key={item.id} theme={item} active={false} onApply={preview} applyLabel="Vista previa" />
              )}</PackageSection>
            )
          })}
          {availableLegacy.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {availableLegacy.map((input) => {
                const item = resolveTheme(input)
                return (
                  <ThemeCard key={item.id} theme={item} active={false} onExport={() => exportSingle(item)} onApply={() => {
                    try {
                      install(input)
                      apply(item.id)
                    } catch (error) {
                      toast.error(message(error))
                    }
                  }} />
                )
              })}
            </div>
          )}
          {!published.length && !availableLegacy.length && (
            <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              {catalog ? 'No hay más temas publicados para este filtro.' : 'Carga el catálogo para ver los paquetes de la comunidad.'}
            </p>
          )}
        </section>
        {ENABLE_CONTRIBUTIONS && contributing && (
          <Dialog open onOpenChange={(open) => {
            if (!open && !busy) { setError(''); setContributing(false) }
          }}>
            <DialogContent showCloseButton={!busy}>
              <DialogHeader>
                <DialogTitle>Contribuir con un tema</DialogTitle>
                <DialogDescription>Selecciona un paquete .qomutheme para validarlo y previsualizar sus variantes antes de enviarlo.</DialogDescription>
              </DialogHeader>
              <p className="text-sm">
                Si todavía estás creando tu tema, consulta el ejemplo y las instrucciones.{' '}
                <a href={CONTRIBUTE_GUIDE} target="_blank" rel="noreferrer" className="text-primary underline">Guía de temas</a>
              </p>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <input ref={contributionInput} type="file" accept=".qomutheme,.zip" className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void prepareFile(file, 'contribute')
                }} />
              <DialogFooter>
                <Button disabled={busy} onClick={() => contributionInput.current?.click()}>
                  <Upload /> {busy ? 'Validando…' : 'Seleccionar paquete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {pending && <PackagePreviewDialog item={pending.item} mode={pending.mode}
          busy={busy || (pending.mode === 'install' && !packagesReady)}
          close={() => setPending(undefined)} onInstall={(id) => void installPending(id)} />}
      </div>
    </div>
  )
}
