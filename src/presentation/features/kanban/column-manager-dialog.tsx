import { useEffect, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import type { Board, BoardColumn, Task } from '@/domain/entities/kanban'
import { isDependentsColumn } from '@/domain/entities/kanban'
import { cn } from '@/lib/utils'

const COLUMN_COLORS = ['#94a3b8', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#ec4899']

function SortableColumnRow({
  column,
  count,
  canDelete,
  onChange,
  onDelete,
}: {
  column: BoardColumn
  count: number
  canDelete: boolean
  onChange: (patch: Partial<BoardColumn>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 p-2.5',
        isDragging && 'relative z-10 border-primary/40 opacity-90 shadow-lg',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="cursor-grab touch-none rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Reordenar columna ${column.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <input
        type="color"
        value={column.color}
        onChange={(event) => onChange({ color: event.target.value })}
        className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
        aria-label={`Color de ${column.name}`}
      />
      <Input
        value={column.name}
        onChange={(event) => onChange({ name: event.target.value })}
        className="h-8 min-w-24 flex-1 text-xs"
        maxLength={30}
      />
      <label className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
        <Checkbox
          checked={column.isDone}
          onCheckedChange={(checked) => onChange({ isDone: checked === true })}
        />
        Final
      </label>
      <span className="text-[0.6rem] text-muted-foreground">{count} tareas</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        disabled={!canDelete}
        onClick={onDelete}
        title={
          isDependentsColumn(column)
            ? 'La columna Dependientes no se puede eliminar'
            : count > 0
              ? 'Mueve las tareas antes de eliminar esta columna'
              : 'Eliminar columna'
        }
        aria-label={`Eliminar columna ${column.name}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

export function ColumnManagerDialog({
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
  const [columns, setColumns] = useState<BoardColumn[]>(board.columns)
  const [pending, setPending] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (open) setColumns(board.columns.map((column) => ({ ...column })))
  }, [board.columns, open])

  const update = (id: string, patch: Partial<BoardColumn>) => {
    setColumns((current) =>
      current.map((column) => (column.id === id ? { ...column, ...patch } : column)),
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setColumns((current) => {
      const from = current.findIndex((column) => column.id === active.id)
      const to = current.findIndex((column) => column.id === over.id)
      if (from < 0 || to < 0) return current
      return arrayMove(current, from, to)
    })
  }

  const countFor = (id: string) => tasks.filter((task) => task.columnId === id).length

  const addColumn = () => {
    setColumns((current) => [
      ...current,
      {
        id: `col-${Date.now().toString(36)}`,
        name: 'Nueva columna',
        color: COLUMN_COLORS[current.length % COLUMN_COLORS.length],
        isDone: false,
      },
    ])
  }

  const save = async () => {
    if (columns.length === 0) {
      toast.error('El tablero necesita al menos una columna.')
      return
    }
    if (columns.some((column) => !column.name.trim())) {
      toast.error('Todas las columnas necesitan un nombre.')
      return
    }
    setPending(true)
    try {
      await container.boards.update(workspace.id, board.id, {
        columns: columns.map((column) => ({ ...column, name: column.name.trim() })),
      })
      toast.success('Columnas actualizadas.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar las columnas.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar columnas</DialogTitle>
          <DialogDescription>
            Cambia nombres y colores, arrastra desde el asa para ordenarlas, marca qué columna
            completa tareas o añade nuevas.
          </DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2">
            <SortableContext
              items={columns.map((column) => column.id)}
              strategy={verticalListSortingStrategy}
            >
              {columns.map((column) => {
                const count = countFor(column.id)
                return (
                  <SortableColumnRow
                    key={column.id}
                    column={column}
                    count={count}
                    canDelete={count === 0 && columns.length > 1 && !isDependentsColumn(column)}
                    onChange={(patch) => update(column.id, patch)}
                    onDelete={() =>
                      setColumns((current) => current.filter((item) => item.id !== column.id))
                    }
                  />
                )
              })}
            </SortableContext>
          </div>
        </DndContext>

        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addColumn}>
          <Plus className="size-4" /> Añadir columna
        </Button>

        <div className="rounded-lg bg-muted/50 p-2.5 text-[0.65rem] text-muted-foreground">
          Las columnas marcadas como <strong className="text-foreground">Final</strong> marcan las
          tareas como completadas automáticamente.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={pending}>
            Guardar columnas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
