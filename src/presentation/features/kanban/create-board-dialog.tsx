import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KanbanSquare, Loader2, Plus } from 'lucide-react'
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
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'

export function CreateBoardDialog({ trigger }: { trigger: React.ReactNode }) {
  const container = useContainer()
  const { workspace, uid, can } = useWorkspaceData()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!can('board.create')) {
      toast.error('No tienes permisos para crear tableros.')
      return
    }
    setPending(true)
    try {
      const board = await container.boards.create({
        workspaceId: workspace.id,
        name,
        description,
        createdBy: uid,
      })
      toast.success(`Tablero “${board.name}” creado.`)
      setOpen(false)
      setName('')
      setDescription('')
      navigate(`/w/${workspace.id}/boards/${board.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el tablero.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KanbanSquare className="size-4 text-primary" /> Nuevo tablero
          </DialogTitle>
          <DialogDescription>
            Un tablero agrupa tareas en columnas. Podrás personalizarlas después.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="board-name">Nombre</Label>
            <Input
              id="board-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Producto Q1"
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="board-description">Descripción</Label>
            <Textarea
              id="board-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Objetivo del tablero"
              rows={3}
              maxLength={300}
            />
          </div>
          <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            Columnas iniciales: <strong className="text-foreground">Por hacer</strong>,{' '}
            <strong className="text-foreground">En curso/rechazadas</strong>,{' '}
            <strong className="text-foreground">En revisión</strong> y{' '}
            <strong className="text-foreground">Hecho</strong>.
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Crear tablero
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
