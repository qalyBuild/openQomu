import { useId, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { KanbanSquare, Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { BOARD_STATUSES, isBoardStatus, type Board, type BoardStatus } from '@/domain/entities/kanban'
import type { BoardPatch } from '@/domain/ports'
import { BOARD_STATUS_LABELS } from './board-status-badge'

type BoardDialogProps =
  | { trigger: ReactNode; board?: never; open?: never; onOpenChange?: never }
  | { board: Board; open: boolean; onOpenChange: (open: boolean) => void; trigger?: never }

export function BoardDialog({ trigger, board, open: controlledOpen, onOpenChange }: BoardDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {open && <BoardForm key={board?.id} board={board} close={() => setOpen(false)} />}
    </Dialog>
  )
}

function BoardForm({ board, close }: { board?: Board; close: () => void }) {
  const container = useContainer()
  const { workspace, uid, can } = useWorkspaceData()
  const navigate = useNavigate()
  const id = useId()
  const [initial] = useState(() => ({
    name: board?.name ?? '',
    description: board?.description ?? '',
    status: board?.status ?? 'normal',
  }))
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [status, setStatus] = useState<BoardStatus>(initial.status)
  const [pending, setPending] = useState(false)
  const nameChanged = name.trim() !== initial.name.trim()
  const descriptionChanged = description.trim() !== initial.description.trim()
  const statusChanged = status !== initial.status
  const canSubmit = !pending && name.trim().length >= 2 && (nameChanged || descriptionChanged || statusChanged)
  const SubmitIcon = board ? Pencil : Plus

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    const allowed = board ? can('board.manage') || board.createdBy === uid : can('board.create')
    if (!allowed) {
      toast.error(board ? 'No tienes permisos para editar este tablero.' : 'No tienes permisos para crear tableros.')
      return
    }
    setPending(true)
    try {
      if (board) {
        const patch: BoardPatch = {}
        if (nameChanged) patch.name = name
        if (descriptionChanged) patch.description = description
        if (statusChanged) patch.status = status
        await container.boards.update(workspace.id, board.id, patch)
        toast.success('Tablero actualizado.')
        close()
      } else {
        const created = await container.boards.create({
          workspaceId: workspace.id,
          name,
          description,
          createdBy: uid,
        })
        toast.success(`Tablero “${created.name}” creado.`)
        close()
        navigate(`/w/${workspace.id}/boards/${created.id}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el tablero.')
    } finally {
      setPending(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KanbanSquare className="size-4 text-primary" /> {board ? 'Editar tablero' : 'Nuevo tablero'}
        </DialogTitle>
        <DialogDescription>
          {board
            ? 'Cambia el nombre, la descripción o el estado del tablero.'
            : 'Un tablero agrupa tareas en columnas. Podrás personalizarlas después.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>Nombre</Label>
          <Input
            id={`${id}-name`}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Producto Q1"
            maxLength={60}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-description`}>Descripción</Label>
          <Textarea
            id={`${id}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Objetivo del tablero"
            rows={3}
            maxLength={300}
          />
        </div>
        {board ? (
          <div className="space-y-2">
            <Label htmlFor={`${id}-status`}>Estado</Label>
            <Select value={status} onValueChange={(value) => {
              if (isBoardStatus(value)) setStatus(value)
            }}>
              <SelectTrigger id={`${id}-status`} aria-describedby={`${id}-status-help`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>{BOARD_STATUS_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id={`${id}-status-help`} className="text-xs text-muted-foreground">
              En pausa y Deprecated ocultan los indicadores y silencian los avisos del tablero.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            Columnas iniciales: <strong className="text-foreground">Por hacer</strong>,{' '}
            <strong className="text-foreground">En curso/rechazadas</strong>,{' '}
            <strong className="text-foreground">En revisión</strong> y{' '}
            <strong className="text-foreground">Hecho</strong>.
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <SubmitIcon className="size-4" />}
            {board ? 'Guardar cambios' : 'Crear tablero'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
