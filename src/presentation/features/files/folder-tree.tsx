import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  FileArchive,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FileFolder, FileMeta } from '@/domain/entities/chat'
import type { FolderNode } from '@/domain/services/file-folder-service'
import { buildFolderTree } from '@/domain/services/file-folder-service'
import { cn } from '@/lib/utils'

/** Archivos de la carpeta y de todo su subárbol. */
function countTreeFiles(node: FolderNode, files: FileMeta[]): number {
  const ids = new Set<string>([node.id])
  const visit = (current: FolderNode) => {
    for (const child of current.children) {
      ids.add(child.id)
      visit(child)
    }
  }
  visit(node)
  return files.filter((file) => file.folderId && ids.has(file.folderId)).length
}

/** Indica si la carpeta activa está dentro de este nodo (incluido él mismo). */
function containsFolder(node: FolderNode, id: string | null): boolean {
  if (!id) return false
  if (node.id === id) return true
  return node.children.some((child) => containsFolder(child, id))
}

function FolderRow({
  node,
  depth,
  files,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDownload,
  canManage,
  onDropFile,
}: {
  node: FolderNode
  depth: number
  files: FileMeta[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: (parentId: string) => void
  onRename: (folder: FileFolder) => void
  onDelete: (folder: FileFolder) => void
  onDownload: (folder: FileFolder) => void
  canManage: (folder: FileFolder) => boolean
  onDropFile: (fileId: string, folderId: string) => void
}) {
  const activeInside = containsFolder(node, activeId)
  const [open, setOpen] = useState(depth < 1 || activeInside)
  const [dropActive, setDropActive] = useState(false)
  const totalCount = countTreeFiles(node, files)
  const active = activeId === node.id

  // Como en VS Code, la ruta hacia la carpeta activa se expande automáticamente.
  useEffect(() => {
    if (activeInside) setOpen(true)
  }, [activeInside])

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md pe-1 text-xs transition-colors',
          active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
          dropActive && 'bg-primary/10 ring-1 ring-primary/40',
        )}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('application/x-openqomu-file')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setDropActive(true)
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          const fileId = event.dataTransfer.getData('application/x-openqomu-file')
          setDropActive(false)
          if (!fileId) return
          event.preventDefault()
          onDropFile(fileId, node.id)
        }}
        style={{ paddingInlineStart: `${2 + depth * 12}px` }}
      >
        <button
          type="button"
          className={cn(
            'grid size-6 place-items-center rounded text-muted-foreground transition-transform hover:bg-background/60',
            node.children.length === 0 && 'invisible',
            open && 'rotate-90',
          )}
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? `Contraer ${node.name}` : `Expandir ${node.name}`}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-start"
          title={node.name}
        >
          {open ? (
            <FolderOpen className="size-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="size-4 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{node.name}</span>
          {totalCount > 0 && (
            <span className="ms-auto text-[0.7rem] tabular-nums text-muted-foreground">
              {totalCount}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover-action size-6 text-muted-foreground"
              aria-label={`Acciones de ${node.name}`}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreate(node.id)}>
              <Plus className="size-4" /> Nueva subcarpeta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(node)}>
              <FileArchive className="size-4" /> Descargar .zip
            </DropdownMenuItem>
            {canManage(node) && (
              <>
                <DropdownMenuItem onClick={() => onRename(node)}>
                  <Pencil className="size-4" /> Renombrar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(node)}>
                  <Trash2 className="size-4" /> Eliminar carpeta
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              depth={depth + 1}
              files={files}
              activeId={activeId}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
              onDownload={onDownload}
              canManage={canManage}
              onDropFile={onDropFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FolderTree({
  folders,
  files,
  activeId,
  onSelect,
  onSelectAll,
  allActive = false,
  onCreate,
  onRename,
  onDelete,
  onDownload,
  canManage,
  onDropFile,
  showHeader = true,
}: {
  folders: FileFolder[]
  files: FileMeta[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onSelectAll: () => void
  allActive?: boolean
  onCreate: (parentId: string | null) => void
  onRename: (folder: FileFolder) => void
  onDelete: (folder: FileFolder) => void
  onDownload: (folder: FileFolder) => void
  canManage: (folder: FileFolder) => boolean
  onDropFile: (fileId: string, folderId: string | null) => void
  showHeader?: boolean
}) {
  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const totalFiles = files.length
  const [rootDropActive, setRootDropActive] = useState(false)

  return (
    <div className="space-y-0.5">
      {showHeader && (
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Carpetas
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={() => onCreate(null)}
            aria-label="Nueva carpeta en la raíz"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}
      <button
        type="button"
        onClick={onSelectAll}
        title="Ver los archivos de todas las carpetas"
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('application/x-openqomu-file')) return
          event.preventDefault()
          setRootDropActive(true)
        }}
        onDragLeave={() => setRootDropActive(false)}
        onDrop={(event) => {
          const fileId = event.dataTransfer.getData('application/x-openqomu-file')
          setRootDropActive(false)
          if (!fileId) return
          event.preventDefault()
          onDropFile(fileId, null)
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs transition-colors',
          allActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
          rootDropActive && 'bg-primary/10 ring-1 ring-primary/40',
        )}
      >
        <FolderOpen className="size-4 text-amber-500" />
        <span className="flex-1 truncate">Todos los archivos</span>
        {totalFiles > 0 && (
          <span className="text-[0.7rem] tabular-nums text-muted-foreground">{totalFiles}</span>
        )}
      </button>
      {tree.map((node) => (
        <FolderRow
          key={node.id}
          node={node}
          depth={0}
          files={files}
          activeId={activeId}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          onDownload={onDownload}
          canManage={canManage}
          onDropFile={onDropFile}
        />
      ))}
      {tree.length === 0 && (
        <p className="px-3 py-4 text-center text-[0.72rem] text-muted-foreground">
          Sin carpetas todavía.
        </p>
      )}
    </div>
  )
}
