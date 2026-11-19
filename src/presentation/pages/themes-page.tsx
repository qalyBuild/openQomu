import { useMemo, useRef, useState } from 'react'
import { Check, Download, Loader2, Moon, Palette, RefreshCw, Sun, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useTheme } from '@/app/theme-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { DEFAULT_THEME_ID, isBuiltinTheme, fetchCatalog } from '@/app/theme/registry'
import { parseThemeFile, serializeTheme } from '@/app/theme/validate'
import { resolveTheme, type Theme, type ThemeInput } from '@/app/theme/tokens'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'light' | 'dark'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'light', label: 'Claros' },
  { value: 'dark', label: 'Oscuros' },
]

function ThemePreview({ theme }: { theme: Theme }) {
  const t = theme.tokens
  return (
    <div
      aria-hidden="true"
      className="flex h-36 gap-2 border-b p-3"
      style={{ background: t.background, color: t.foreground, borderColor: t.border }}
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
  installed,
  onApply,
  onExport,
  onRemove,
}: {
  theme: Theme
  active: boolean
  installed: boolean
  onApply: () => void
  onExport: () => void
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
            Aplicar
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1 border-t px-3 py-2">
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-[0.65rem]" onClick={onExport}>
          <Download className="size-3" /> Exportar
        </Button>
        {installed && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[0.65rem] text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-3" /> Eliminar
          </Button>
        )}
      </div>
    </div>
  )
}

export function ThemesPage() {
  const { uid } = useWorkspaceData()
  const { profile, session } = useAuth()
  const container = useContainer()
  const { theme, themes, setTheme, install, remove } = useTheme()
  const [filter, setFilter] = useState<Filter>('all')
  const [catalog, setCatalog] = useState<ThemeInput[] | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const visible = useMemo(
    () => themes.filter((item) => filter === 'all' || item.scheme === filter),
    [filter, themes],
  )
  const catalogThemes = useMemo(
    () =>
      (catalog ?? [])
        .filter((item) => !themes.some((current) => current.id === item.id))
        .filter((item) => filter === 'all' || item.scheme === filter)
        .map(resolveTheme),
    [catalog, filter, themes],
  )

  const apply = (id: string) => {
    setTheme(id)
    if (session) {
      void container.users.updateProfile(uid, { themeId: id }).catch(() => {
        toast.error('El tema se aplicó, pero no se pudo guardar en tu perfil.')
      })
    }
  }

  const exportTheme = (item: Theme) => {
    const url = URL.createObjectURL(
      new Blob([serializeTheme(item)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `${item.id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importTheme = async (file: File) => {
    const result = parseThemeFile(await file.text())
    if (!result.ok) {
      toast.error(result.errors[0] ?? 'El tema no es válido.')
      return
    }
    try {
      install(result.value)
      apply(result.value.id)
      toast.success(`Tema “${result.value.name}” instalado.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo instalar el tema.')
    }
  }

  const removeTheme = (item: Theme) => {
    if (!remove(item.id)) return
    if (profile?.themeId === item.id) {
      void container.users.updateProfile(uid, { themeId: DEFAULT_THEME_ID }).catch(() => {})
    }
    toast.success(`Tema “${item.name}” eliminado.`)
  }

  const loadCatalog = async () => {
    setLoadingCatalog(true)
    const items = await fetchCatalog()
    setCatalog(items)
    setLoadingCatalog(false)
    if (items.length === 0) toast.error('No se pudo cargar el catálogo de la comunidad.')
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-5 pb-12 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Apariencia</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em]">
              <Palette className="size-5" /> Temas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige cómo se ve openQomu. El tema activo es <strong>{theme.name}</strong>.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void importTheme(file)
              }}
            />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()}>
              <Upload className="size-3.5" /> Importar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={filter === option.value ? 'secondary' : 'ghost'}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ThemeCard
              key={item.id}
              theme={item}
              active={item.id === theme.id}
              installed={!isBuiltinTheme(item.id)}
              onApply={() => apply(item.id)}
              onExport={() => exportTheme(item)}
              onRemove={isBuiltinTheme(item.id) ? undefined : () => removeTheme(item)}
            />
          ))}
        </div>

        <section data-glass-surface="panel" className="rounded-2xl border bg-card/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Comunidad</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Temas publicados en openQomu. Se validan antes de instalarse.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void loadCatalog()}>
              {loadingCatalog ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : catalog ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <Palette className="size-3.5" />
              )}
              {catalog ? 'Actualizar catálogo' : 'Explorar catálogo'}
            </Button>
          </div>

          {catalogThemes.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {catalogThemes.map((item) => (
                <ThemeCard
                  key={item.id}
                  theme={item}
                  active={item.id === theme.id}
                  installed={false}
                  onApply={() => {
                    install(item)
                    apply(item.id)
                    toast.success(`Tema “${item.name}” instalado.`)
                  }}
                  onExport={() => exportTheme(item)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              {catalog
                ? 'No hay más temas publicados para este filtro.'
                : 'Carga el catálogo para ver temas creados por la comunidad.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
