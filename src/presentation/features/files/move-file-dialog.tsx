import { useEffect, useMemo, useState } from 'react'
import { Check, Folder, FolderOpen, HardDrive } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { FileFolder } from '@/domain/entities/chat'
import type { FolderNode } from '@/domain/services/file-folder-service'
import { buildFolderTree } from '@/domain/services/file-folder-service'
import { cn } from '@/lib/utils'

function flatten(nodes: FolderNode[], depth = 0): Array<FileFolder & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flatten(node.children, depth + 1),
  ])
}

export function MoveFileDialog({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  fileName,
  fileCount = 1,
  onMove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: FileFolder[]
  currentFolderId: string | null
  fileName: string
  fileCount?: number
  onMove: (folderId: string | null) => Promise<void> | void
}) {
  const [selected, setSelected] = useState<string | null>(currentFolderId)
  const list = useMemo(() => flatten(buildFolderTree(folders)), [folders])
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) setSelected(currentFolderId)
  }, [currentFolderId, open])

  const move = async () => {
    setPending(true)
    try {
      await onMove(selected)
      onOpenChange(false)
    } catch {
      // El llamador muestra el error y el diálogo sigue abierto.
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSelected(currentFolderId)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover {fileCount === 1 ? 'archivo' : `${fileCount} archivos`}</DialogTitle>
          <DialogDescription>
            {fileCount === 1
              ? `Elige la carpeta de destino para “${fileName}”.`
              : 'Elige la carpeta de destino para la selección.'}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-xs transition-colors',
              selected === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
            )}
          >
            <HardDrive className="size-4" />
            <span className="flex-1">Raíz del workspace</span>
            {selected === null && <Check className="size-3.5" />}
          </button>
          {list.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setSelected(folder.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md py-2 pe-2 text-start text-xs transition-colors',
                selected === folder.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
              style={{ paddingInlineStart: `${8 + folder.depth * 16}px` }}
            >
              {selected === folder.id ? (
                <FolderOpen className="size-3.5 shrink-0" />
              ) : (
                <Folder className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{folder.name}</span>
              {selected === folder.id && <Check className="size-3.5" />}
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No hay carpetas. El archivo se moverá a la raíz.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void move()} disabled={pending}>
            Mover aquí
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
