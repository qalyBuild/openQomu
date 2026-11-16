import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  flattenPageTree,
  buildPageTree,
  textFromContent,
} from '@/domain/services/page-service'
import { formatRelative } from '@/lib/date'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { CreatePageDialog } from '@/presentation/features/pages/create-page-dialog'

export function PagesPage() {
  const { workspace, pages, loading, can } = useWorkspaceData()
  const [query, setQuery] = useState('')

  const flat = useMemo(() => flattenPageTree(buildPageTree(pages)), [pages])
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return flat
    return flat.filter((page) => {
      const text = `${page.title} ${textFromContent(page.content)}`.toLowerCase()
      return text.includes(normalized)
    })
  }, [flat, query])

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-5 pb-12 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Notion-style</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Documentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Decisiones, briefs, actas y conocimiento del equipo. Todo conectado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar páginas…"
                className="h-9 w-48 ps-8 text-xs sm:w-64"
              />
            </div>
            {can('page.create') && (
              <CreatePageDialog
                trigger={
                  <Button className="h-9 gap-1.5">
                    <Plus className="size-4" /> Nueva página
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : flat.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Tu conocimiento empieza aquí"
            description="Crea una página para documentar decisiones, procesos o ideas. Puedes anidar páginas y usar plantillas."
            action={
              <CreatePageDialog
                trigger={
                  <Button>
                    <Plus className="size-4" /> Crear página
                  </Button>
                }
              />
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description={`No encontramos páginas que coincidan con “${query}”.`}
            action={
              <Button variant="outline" onClick={() => setQuery('')}>
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((page) => {
              const excerpt = textFromContent(page.content)
              return (
                <Link
                  key={page.id}
                  to={`/w/${workspace.id}/pages/${page.id}`}
                  className="group"
                >
                  <div className="flex h-full flex-col rounded-2xl border bg-card/70 p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-lg group-hover:shadow-primary/5">
                    <div className="flex items-start justify-between">
                      <span className="text-2xl leading-none">{page.icon}</span>
                      <ChevronRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <h2 className="mt-3 line-clamp-2 text-sm font-semibold tracking-tight">
                      {page.title}
                    </h2>
                    <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                      {excerpt || 'Página vacía'}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-[0.62rem] text-muted-foreground">
                      <span>Editado {formatRelative(page.updatedAt)}</span>
                      {page.depth > 0 && (
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          nivel {page.depth + 1}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
