import { useMemo, useState } from 'react'
import { Loader2, Plus, RotateCcw, Tag, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { TASK_LABELS, type Board, type Task } from '@/domain/entities/kanban'
import { collectTaskLabels, MAX_TASK_LABEL_LENGTH } from '@/domain/services/task-service'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'

/** Borra cualquier etiqueta de todas las tareas del tablero. */
export function LabelManagerDialog({
  open,
  onOpenChange,
  board,
  tasks,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  board: Board
  tasks: Task[]
}) {
  const container = useContainer()
  const { workspace } = useWorkspaceData()
  const [target, setTarget] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)

  const hidden = useMemo(() => new Set(board.hiddenLabels ?? []), [board.hiddenLabels])
  const customLabels = useMemo(() => board.customLabels ?? [], [board.customLabels])
  const hiddenDefaults = useMemo(
    () => (board.hiddenLabels ?? []).filter((label) => (TASK_LABELS as readonly string[]).includes(label)),
    [board.hiddenLabels],
  )
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of tasks) {
      for (const label of task.labels) map.set(label, (map.get(label) ?? 0) + 1)
    }
    return map
  }, [tasks])
  const labels = useMemo(() => {
    const defaults = TASK_LABELS.filter((label) => !hidden.has(label))
    const custom = [...new Set([...customLabels, ...collectTaskLabels(tasks)])]
      .filter(
        (label) =>
          !hidden.has(label) && !(TASK_LABELS as readonly string[]).includes(label),
      )
      .sort((a, b) => a.localeCompare(b, 'es'))
    return [...defaults, ...custom]
  }, [customLabels, hidden, tasks])

  const targetCount = target ? counts.get(target) ?? 0 : 0
  const targetIsDefault = target
    ? (TASK_LABELS as readonly string[]).includes(target)
    : false

  const removeLabel = async () => {
    if (!target) return
    const affected = tasks.filter((task) => task.labels.includes(target))
    try {
      await Promise.all(
        affected.map((task) =>
          container.tasks.update(workspace.id, board.id, task.id, {
            labels: task.labels.filter((label) => label !== target),
          }),
        ),
      )
      if (targetIsDefault) {
        await container.boards.update(workspace.id, board.id, {
          hiddenLabels: [...new Set([...(board.hiddenLabels ?? []), target])],
        })
      } else {
        await container.boards.update(workspace.id, board.id, {
          customLabels: customLabels.filter((label) => label !== target),
        })
      }
      toast.success(
        targetIsDefault
          ? `Etiqueta “${target}” ocultada de las sugerencias.`
          : `Etiqueta “${target}” eliminada de ${affected.length} tarea(s).`,
      )
      setTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo borrar la etiqueta.')
    }
  }

  const createLabel = async () => {
    const label = newLabel.trim().toLowerCase()
    if (!label) return
    if (label.length > MAX_TASK_LABEL_LENGTH) {
      toast.error(`Cada etiqueta admite máximo ${MAX_TASK_LABEL_LENGTH} caracteres.`)
      return
    }
    if (labels.includes(label)) {
      toast.error('Esa etiqueta ya existe en el tablero.')
      return
    }
    setCreating(true)
    try {
      await container.boards.update(workspace.id, board.id, {
        customLabels: [...customLabels, label],
      })
      setNewLabel('')
      toast.success(`Etiqueta “${label}” creada.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la etiqueta.')
    } finally {
      setCreating(false)
    }
  }

  const restoreDefaults = async () => {
    try {
      await container.boards.update(workspace.id, board.id, {
        hiddenLabels: (board.hiddenLabels ?? []).filter(
          (label) => !(TASK_LABELS as readonly string[]).includes(label),
        ),
      })
      toast.success('Etiquetas predeterminadas restauradas.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron restaurar.')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4" /> Etiquetas del tablero
            </DialogTitle>
            <DialogDescription>
              Crea etiquetas propias del tablero y borra las que ya no uses. Las personalizadas se
              conservan aunque ninguna tarea las use; las predeterminadas ocultas se pueden
              restaurar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void createLabel()
                }
              }}
              placeholder="Nueva etiqueta, p. ej. dashboard/qa"
              maxLength={MAX_TASK_LABEL_LENGTH}
              className="h-9 text-xs"
            />
            <Button
              className="h-9 shrink-0 gap-1.5"
              onClick={() => void createLabel()}
              disabled={creating || !newLabel.trim()}
            >
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Añadir
            </Button>
          </div>

          {labels.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
              Este tablero todavía no tiene etiquetas.
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto pe-1">
              {labels.map((label) => {
                const count = counts.get(label) ?? 0
                return (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-lg border bg-background/40 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
                    <span className="shrink-0 text-[0.62rem] text-muted-foreground">
                      {count} {count === 1 ? 'tarea' : 'tareas'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setTarget(label)}
                      aria-label={`Borrar etiqueta ${label}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            {hiddenDefaults.length > 0 ? (
              <Button variant="ghost" className="gap-1.5 text-xs" onClick={() => void restoreDefaults()}>
                <RotateCcw className="size-3.5" /> Restaurar predeterminadas
              </Button>
            ) : (
              <span />
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(next) => !next && setTarget(null)}
        title={`¿Borrar la etiqueta “${target ?? ''}”?`}
        description={
          targetCount > 0
            ? `Se quitará de ${targetCount} tarea(s) de este tablero.`
            : 'Se ocultará de las sugerencias de este tablero. Podrás restaurarla si es predeterminada.'
        }
        confirmLabel="Borrar etiqueta"
        onConfirm={removeLabel}
      />
    </>
  )
}
