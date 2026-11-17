import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { FileFolder } from '@/domain/entities/chat'
import { descendantFolderIds } from '@/domain/services/file-folder-service'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { cn } from '@/lib/utils'
import { FolderTree } from './folder-tree'
import { NameDialog } from './name-dialog'
import { useFolderDownload } from './use-folder-download'

type FolderDialog =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'rename'; folder: FileFolder }

/**
 * Explorador de archivos del sidebar izquierdo: árbol de carpetas, acciones y
 * papelera. Reemplaza la lista plana de carpetas que había antes.
 */
export function FilesExplorer({ onNavigate }: { onNavigate?: () => void }) {
  const { workspace, folders, files, trashedFiles, uid, can } = useWorkspaceData()
  const container = useContainer()
  const { downloadFolder } = useFolderDownload()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [folderDialog, setFolderDialog] = useState<FolderDialog | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileFolder | null>(null)

  const view = params.get('view') === 'trash' ? 'trash' : 'files'
  const currentFolderId = params.get('folder')
  const showAll = params.get('scope') === 'all'
  const libraryActive = view === 'files' && !currentFolderId && !showAll

  const mutate = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    change(next)
    setParams(next, { replace: true })
  }

  const selectFolder = (folderId: string | null) => {
    mutate((next) => {
      next.delete('view')
      next.delete('scope')
      next.delete('file')
      if (folderId) next.set('folder', folderId)
      else next.delete('folder')
    })
    onNavigate?.()
  }

  const selectAllFiles = () => {
    mutate((next) => {
      next.delete('view')
      next.delete('folder')
      next.delete('file')
      next.set('scope', 'all')
    })
    onNavigate?.()
  }

  const openLibrary = () => {
    mutate((next) => {
      next.delete('view')
      next.delete('folder')
      next.delete('scope')
      next.delete('file')
    })
    onNavigate?.()
  }

  const openTrash = () => {
    navigate(`/w/${workspace.id}/files?view=trash`)
    onNavigate?.()
  }

  const saveFolder = async (name: string) => {
    if (!folderDialog) return
    try {
      if (folderDialog.mode === 'create') {
        const folder = await container.fileFolders.create({
          workspaceId: workspace.id,
          name,
          parentId: folderDialog.parentId,
          createdBy: uid,
        })
        // Se mantiene el drawer abierto para ver la carpeta recién creada.
        mutate((next) => {
          next.delete('view')
          next.delete('scope')
          next.delete('file')
          next.set('folder', folder.id)
        })
        toast.success('Carpeta creada.')
      } else {
        await container.fileFolders.update(workspace.id, folderDialog.folder.id, { name })
        toast.success('Carpeta renombrada.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la carpeta.')
      throw error
    }
  }

  const deleteFolder = async () => {
    if (!deleteTarget) return
    const ids = [deleteTarget.id, ...descendantFolderIds(folders, deleteTarget.id)]
    const at = new Date().toISOString()
    try {
      const inside = files.filter((file) => file.folderId && ids.includes(file.folderId))
      for (const file of inside) {
        await container.files.update(workspace.id, file.id, { trashedAt: at })
      }
      for (const id of ids.reverse()) {
        await container.fileFolders.remove(workspace.id, id)
      }
      if (currentFolderId && ids.includes(currentFolderId)) {
        mutate((next) => {
          next.delete('folder')
          next.delete('file')
        })
      }
      toast.success('Carpeta eliminada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la carpeta.')
    }
  }

  const dropFileIntoFolder = async (fileId: string, folderId: string | null) => {
    const file = files.find((item) => item.id === fileId)
    if (!file || file.folderId === folderId) return
    try {
      await container.files.update(workspace.id, fileId, { folderId })
      toast.success(folderId ? 'Archivo movido.' : 'Archivo movido a la raíz.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo mover el archivo.')
    }
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Explorador
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground hover:text-foreground"
          aria-label="Nueva carpeta"
          onClick={() =>
            setFolderDialog({ mode: 'create', parentId: currentFolderId ?? null })
          }
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <button
        type="button"
        onClick={openLibrary}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.84rem] transition-colors',
          libraryActive
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )}
      >
        <FolderOpen className="size-3.5 shrink-0 text-amber-500" />
        <span className="min-w-0 flex-1 truncate text-start">Biblioteca</span>
        <span className="text-[0.7rem] tabular-nums text-muted-foreground">{files.length}</span>
      </button>

      <FolderTree
        folders={folders}
        files={files}
        activeId={showAll ? null : currentFolderId}
        allActive={showAll}
        onSelect={selectFolder}
        onSelectAll={selectAllFiles}
        onCreate={(parentId) => setFolderDialog({ mode: 'create', parentId })}
        onRename={(folder) => setFolderDialog({ mode: 'rename', folder })}
        onDelete={setDeleteTarget}
        onDownload={(folder) => void downloadFolder(folder)}
        canManage={(folder) => folder.createdBy === uid || can('file.deleteAny')}
        onDropFile={(fileId, folderId) => void dropFileIntoFolder(fileId, folderId)}
        showHeader={false}
      />

      <div className="my-2 border-t border-sidebar-border" />
      <button
        type="button"
        onClick={openTrash}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.84rem] transition-colors',
          view === 'trash'
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )}
      >
        <Trash2 className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-start">Papelera</span>
        {trashedFiles.length > 0 && (
          <span className="text-[0.7rem] tabular-nums text-muted-foreground">
            {trashedFiles.length}
          </span>
        )}
      </button>

      <NameDialog
        open={folderDialog !== null}
        onOpenChange={(open) => !open && setFolderDialog(null)}
        title={folderDialog?.mode === 'rename' ? 'Renombrar carpeta' : 'Nueva carpeta'}
        description={
          folderDialog?.mode === 'create'
            ? folderDialog.parentId
              ? 'Se creará dentro de la carpeta seleccionada.'
              : 'Se creará en la raíz del workspace.'
            : undefined
        }
        initialValue={folderDialog?.mode === 'rename' ? folderDialog.folder.name : ''}
        placeholder="Ej. Diseño, Contratos, Beta…"
        submitLabel={folderDialog?.mode === 'rename' ? 'Renombrar' : 'Crear carpeta'}
        onSubmit={saveFolder}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`¿Eliminar la carpeta “${deleteTarget?.name ?? ''}”?`}
        description="Su contenido se moverá a la papelera. Las carpetas se eliminarán definitivamente."
        confirmLabel="Eliminar carpeta"
        onConfirm={deleteFolder}
      />
    </div>
  )
}
