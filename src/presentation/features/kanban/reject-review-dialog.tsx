import { useRef, useState } from 'react'
import { Paperclip, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Board, Task } from '@/domain/entities/kanban'
import { isDependentsColumn, isReviewColumn } from '@/domain/entities/kanban'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { formatBytes } from '@/domain/services/file-service'

/** Devuelve la tarea a trabajo con el motivo documentado por el revisor. */
export function RejectReviewDialog({
  open,
  onOpenChange,
  task,
  board,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  board: Board
}) {
  const container = useContainer()
  const { workspace } = useWorkspaceData()
  const { session, profile } = useAuth()
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reviewColumn = board.columns.find(isReviewColumn)
  const targetColumn =
    board.columns.find((column) => column.id === 'doing') ??
    board.columns.find(
      (column) =>
        !column.isDone && !isDependentsColumn(column) && column.id !== reviewColumn?.id,
    ) ??
    board.columns[0]

  const reset = () => {
    setReason('')
    setFiles([])
  }

  const reject = async () => {
    if (!session || !reason.trim() || !targetColumn) return
    setSubmitting(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const meta = await container.files.upload(
          workspace.id,
          { name: file.name, size: file.size, contentType: file.type, data: file },
          session.id,
        )
        uploaded.push(meta.id)
      }
      if (uploaded.length > 0) {
        await container.tasks.update(workspace.id, board.id, task.id, {
          attachmentIds: [...task.attachmentIds, ...uploaded],
        })
      }
      await container.tasks.addComment(workspace.id, board.id, task.id, {
        authorId: session.id,
        authorName: profile?.displayName ?? session.displayName,
        authorPhotoURL: profile?.photoURL ?? session.photoURL,
        body: `Rechazo de revisión: ${reason.trim()}`,
      })
      const targetTasks = board.columns
        ? []
        : []
      void targetTasks
      await container.tasks.move(
        workspace.id,
        board.id,
        task.id,
        targetColumn.id,
        board.columns.length,
        board.columns,
      )
      toast.success(`Revisión rechazada. La tarea vuelve a «${targetColumn.name}».`)
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo rechazar la revisión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submitting) return
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            if (!submitting && reason.trim()) void reject()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="size-4" /> Rechazar revisión
          </DialogTitle>
          <DialogDescription>
            La tarea volverá a «{targetColumn?.name ?? 'Por hacer'}». Explica qué falta y adjunta
            documentación si hace falta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reject-reason" className="text-xs">
            Motivo del rechazo
          </Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Qué debe corregirse antes de volver a revisión…"
            rows={4}
            maxLength={2000}
            autoFocus
          />
          <p className="text-[0.65rem] text-muted-foreground">
            Ctrl/⌘ + Enter para rechazar y devolver.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Documentación (opcional)</Label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const list = Array.from(event.target.files ?? [])
              if (list.length > 0) setFiles((current) => [...current, ...list])
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
          >
            <Paperclip className="size-3.5" /> Adjuntar archivos
          </Button>
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1 text-[0.65rem]"
                >
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Quitar ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={() => void reject()}
            disabled={submitting || !reason.trim()}
          >
            <Undo2 className="size-3.5" /> Rechazar y devolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
