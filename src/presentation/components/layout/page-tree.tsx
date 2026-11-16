import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import type { PageNode } from '@/domain/entities/pages'
import { buildPageTree } from '@/domain/services/page-service'
import { CreatePageDialog } from '@/presentation/features/pages/create-page-dialog'
import { cn } from '@/lib/utils'

function PageTreeItem({
  node,
  workspaceId,
  activeId,
  depth,
}: {
  node: PageNode
  workspaceId: string
  activeId: string | null
  depth: number
}) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = node.children.length > 0
  const active = activeId === node.id

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-0.5 rounded-lg pe-1 text-sm transition-colors',
          active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60',
        )}
        style={{ paddingInlineStart: `${depth * 12}px` }}
      >
        <button
          type="button"
          className={cn(
            'grid size-5 place-items-center rounded text-muted-foreground transition-transform hover:bg-background/60',
            !hasChildren && 'invisible',
            open && 'rotate-90',
          )}
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Contraer subpáginas' : 'Expandir subpáginas'}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <Link
          to={`/w/${workspaceId}/pages/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
        >
          <span className="text-sm leading-none">{node.icon}</span>
          <span className="truncate text-[0.83rem]">{node.title}</span>
        </Link>
        <CreatePageDialog
          parentId={node.id}
          trigger={
            <button
              type="button"
              className="grid size-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background/70 hover:text-foreground group-hover:opacity-100"
              aria-label="Añadir subpágina"
            >
              <Plus className="size-3" />
            </button>
          }
        />
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              workspaceId={workspaceId}
              activeId={activeId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PageTree({ pages, workspaceId }: { pages: PageNode[]; workspaceId: string }) {
  const location = useLocation()
  const activeId = location.pathname.split('/pages/')[1]?.split('/')[0] ?? null

  if (pages.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-muted-foreground">Aún no hay páginas.</p>
        <CreatePageDialog
          trigger={
            <button type="button" className="mt-2 text-xs font-medium text-primary hover:underline">
              Crear la primera
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {pages.map((page) => (
        <PageTreeItem
          key={page.id}
          node={page}
          workspaceId={workspaceId}
          activeId={activeId}
          depth={0}
        />
      ))}
    </div>
  )
}

export function buildTree(pages: Parameters<typeof buildPageTree>[0]): PageNode[] {
  return buildPageTree(pages)
}
