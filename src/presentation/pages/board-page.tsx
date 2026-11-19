import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  CheckCircle2,
  Filter,
  KanbanSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Priority } from '@/domain/entities/identity'
import {
  defaultTaskColumnId,
  isDependentsColumn,
  isReviewColumn,
  TASK_LABELS,
  type Task,
} from '@/domain/entities/kanban'
import {
  collectTaskLabels,
  filterTasks,
  moveTask,
  sortBoardTasks,
  summarizeBoard,
} from '@/domain/services/task-service'
import { PRIORITY_META, PRIORITY_VALUES } from '@/domain/entities/identity'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useBoardTasks } from '@/presentation/hooks/use-data'
import { AvatarStack } from '@/presentation/components/common/user-avatar'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { KanbanColumn } from '@/presentation/features/kanban/kanban-column'
import { TaskCardContent } from '@/presentation/features/kanban/task-card'
import { TaskCreateDialog } from '@/presentation/features/kanban/task-create-dialog'
import { LabelManagerDialog } from '@/presentation/features/kanban/label-manager-dialog'
import { TaskDetailSheet } from '@/presentation/features/kanban/task-detail-sheet'
import { ColumnManagerDialog } from '@/presentation/features/kanban/column-manager-dialog'
import { BoardDialog } from '@/presentation/features/kanban/board-dialog'
import { BoardStatusBadge } from '@/presentation/features/kanban/board-status-badge'
import { isRecentlyActive } from '@/lib/presence'

const collisionDetection: CollisionDetection = (args) => {
  // Con `closestCorners` las columnas son cajas tan grandes que sus esquinas
  // quedan más lejos que las tarjetas vecinas: siempre ganaba una tarjeta de
  // otra columna. Manda el puntero; sobre una tarjeta, ella decide la posición.
  const hits = pointerWithin(args)
  if (hits.length > 0) {
    const overTask = hits.find(
      (hit) =>
        args.droppableContainers.find((container) => container.id === hit.id)?.data.current
          ?.type === 'task',
    )
    return overTask ? [overTask] : hits
  }
  // Sin puntero (teclado) o en el hueco entre columnas: la columna más cercana.
  const columns = args.droppableContainers.filter(
    (container) => container.data.current?.type === 'column',
  )
  return closestCorners({ ...args, droppableContainers: columns })
}

export function BoardPage() {
  const { boardId } = useParams()
  const { workspace, boards, members, files, uid, role, can, loading: workspaceLoading } = useWorkspaceData()
  const board = boards.find((item) => item.id === boardId)
  const { tasks, setTasks, loading } = useBoardTasks(workspace.id, board?.id)
  const container = useContainer()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [assigneeId, setAssigneeId] = useState<string>('all')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [label, setLabel] = useState<string>('all')
  const [mine, setMine] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeWidth, setActiveWidth] = useState(290)
  const openTaskId = params.get('task')
  const taskTrigger = useRef<HTMLElement>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createColumnId, setCreateColumnId] = useState<string>('')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const canManage = can('board.manage') || board?.createdBy === uid
  const filteredTasks = useMemo(
    () =>
      filterTasks(tasks, {
        query,
        assigneeId: assigneeId === 'all' ? null : assigneeId,
        priority: priority === 'all' ? null : priority,
        label: label === 'all' ? null : label,
        onlyMine: mine ? uid : null,
      }),
    [assigneeId, label, mine, priority, query, tasks, uid],
  )
  const labelOptions = useMemo(() => {
    const hidden = new Set(board?.hiddenLabels ?? [])
    const defaults = TASK_LABELS.filter((label) => !hidden.has(label))
    const custom = new Set(board?.customLabels ?? [])
    const extra = [...custom, ...collectTaskLabels(tasks)]
      .filter(
        (item) =>
          !hidden.has(item) &&
          !(TASK_LABELS as readonly string[]).includes(item) &&
          item.trim().length > 0,
      )
      .filter((item, index, list) => list.indexOf(item) === index)
      .sort((a, b) => a.localeCompare(b, 'es'))
    return [...defaults, ...extra]
  }, [board?.customLabels, board?.hiddenLabels, tasks])
  const grouped = useMemo(
    () => (board ? sortBoardTasks(filteredTasks, board.columns) : {}),
    [board, filteredTasks],
  )
  const summary = useMemo(
    () => (board ? summarizeBoard(tasks, board.columns) : null),
    [board, tasks],
  )
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const boardScrollRef = useRef<HTMLDivElement>(null)
  const scrolledBoard = useRef<string | null>(null)

  // En móvil, abre directamente en la primera columna con tareas para no
  // aterrizar en una columna vacía como "Dependientes".
  useEffect(() => {
    if (loading || !board || typeof window === 'undefined' || window.innerWidth >= 640) return
    if (scrolledBoard.current === board.id) return
    const target =
      board.columns.find((column) => (grouped[column.id]?.length ?? 0) > 0) ??
      board.columns.find((column) => column.id === 'todo') ??
      board.columns[0]
    const container = boardScrollRef.current
    const element = container?.querySelector<HTMLElement>(
      `[data-column-id="${target.id}"]`,
    )
    if (container && element) {
      container.scrollTo({ left: element.offsetLeft - 12, behavior: 'auto' })
      scrolledBoard.current = board.id
    }
  }, [board, grouped, loading])

  const activeTask = activeId ? tasks.find((task) => task.id === activeId) ?? null : null
  const activeColumn = activeTask
    ? board?.columns.find((column) => column.id === activeTask.columnId)
    : undefined
  const activeDependencies = activeTask
    ? activeTask.dependsOnTaskIds
        .map((id) => tasksById.get(id))
        .filter((task): task is Task => Boolean(task))
    : []
  const openTask = openTaskId ? tasks.find((task) => task.id === openTaskId) ?? null : null

  useEffect(() => {
    if (params.get('new') === '1' && board) {
      setCreateColumnId(defaultTaskColumnId(board.columns))
      setCreateOpen(true)
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }, [board, params, setParams])

  if (boards.length > 0 && !board) {
    if (workspaceLoading) {
      return (
        <div className="space-y-3 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      )
    }
    return <Navigate to={`/w/${workspace.id}/boards`} replace />
  }

  if (!board) return null

  const openTaskDetail = (task: Task, trigger: HTMLElement) => {
    taskTrigger.current = trigger
    const next = new URLSearchParams(params)
    next.set('task', task.id)
    setParams(next, { replace: true })
  }

  const closeTaskDetail = () => {
    const next = new URLSearchParams(params)
    next.delete('task')
    setParams(next, { replace: true })
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    const dragged = tasks.find((task) => task.id === String(event.active.id))
    const column = boardScrollRef.current?.querySelector<HTMLElement>(
      `[data-column-id="${dragged?.columnId}"]`,
    )
    if (column) setActiveWidth(column.getBoundingClientRect().width)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const dragged = tasks.find((task) => task.id === String(event.active.id))
    if (!dragged || !event.over) return

    const overId = String(event.over.id)
    const overType = event.over.data.current?.type
    let targetColumnId: string
    if (overType === 'column') {
      targetColumnId = overId
    } else {
      const overTask = tasks.find((task) => task.id === overId)
      if (!overTask) return
      targetColumnId = overTask.columnId
    }

    const fullGrouped = sortBoardTasks(tasks, board.columns)
    const targetList = fullGrouped[targetColumnId] ?? []
    let index = targetList.length
    if (overType !== 'column') {
      const overIndex = targetList.findIndex((task) => task.id === overId)
      if (overIndex >= 0) index = overIndex
    }
    if (dragged.columnId === targetColumnId && dragged.id === overId) return

    const optimistic = moveTask(tasks, dragged.id, targetColumnId, index, board.columns)
    setTasks(optimistic)
    try {
      await container.tasks.move(
        workspace.id,
        board.id,
        dragged.id,
        targetColumnId,
        index,
        board.columns,
      )
    } catch (error) {
      setTasks(tasks)
      toast.error(error instanceof Error ? error.message : 'No se pudo mover la tarea.')
    }
  }

  const hasFilters =
    query !== '' || assigneeId !== 'all' || priority !== 'all' || label !== 'all' || mine
  const activePeople = members.filter((member) => isRecentlyActive(member.lastActiveAt))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        data-glass-surface="chrome"
        data-glass-chrome="board-tools"
        className="relative shrink-0 border-b border-border/70 px-4 py-2 sm:px-5"
      >
        <div className="scrollbar-none flex items-center gap-2 overflow-x-auto">
          <BoardStatusBadge status={board.status} />
          <div className="relative shrink-0">
            <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar tareas…"
              className="h-8 w-44 ps-8 text-xs sm:w-56"
            />
          </div>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="h-8 w-[140px] shrink-0 text-xs">
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el equipo</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.uid}>
                  {member.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as Priority | 'all')}
          >
            <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda prioridad</SelectItem>
              {PRIORITY_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: PRIORITY_META[value].color }}
                    />
                    {PRIORITY_META[value].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={label} onValueChange={setLabel}>
            <SelectTrigger className="h-8 w-[140px] shrink-0 text-xs">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda etiqueta</SelectItem>
              {labelOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={mine ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-xs"
            onClick={() => setMine((value) => !value)}
          >
            <Filter className="size-3.5" /> Mis tareas
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 text-xs text-muted-foreground"
              onClick={() => {
                setQuery('')
                setAssigneeId('all')
                setPriority('all')
                setLabel('all')
                setMine(false)
              }}
            >
              <X className="size-3.5" /> Limpiar
            </Button>
          )}
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border bg-card/60 px-2.5 py-1.5 md:flex">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span className="text-[0.68rem] text-muted-foreground">
                {summary?.completed ?? 0}/{summary?.total ?? 0} completadas
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${summary?.completionRate ?? 0}%` }}
                />
              </div>
            </div>
            <Badge variant="outline" className="h-6 shrink-0 text-[0.6rem] text-muted-foreground">
              {filteredTasks.length} de {tasks.length} tareas
            </Badge>
            <AvatarStack
              people={activePeople.map((member) => ({
                id: member.uid,
                displayName: member.displayName,
                photoURL: member.photoURL,
              }))}
              max={4}
              size="sm"
              className="hidden lg:flex"
            />
            <Button
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={() => {
                setCreateColumnId(defaultTaskColumnId(board.columns))
                setCreateOpen(true)
              }}
            >
              <Plus className="size-3.5" /> Nueva tarea
            </Button>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="Opciones del tablero">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditingBoardId(board.id)}>
                    <Pencil className="size-4" /> Editar tablero
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLabelsOpen(true)}>
                    <Tag className="size-4" /> Gestionar etiquetas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColumnsOpen(true)}>
                    <Settings2 className="size-4" /> Configurar columnas
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" /> Eliminar tablero
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loading && tasks.length === 0 ? (
          <div
            className="grid gap-3 p-4"
            style={{ gridTemplateColumns: `repeat(${board.columns.length}, minmax(180px, 1fr))` }}
          >
            {board.columns.map((column) => (
              <Skeleton key={column.id} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="grid h-full place-items-center p-6">
            <EmptyState
              icon={KanbanSquare}
              title="Este tablero está vacío"
              description="Crea la primera tarea y arrástrala entre columnas para seguir el avance."
              action={
                <Button
                  onClick={() => {
                    setCreateColumnId(defaultTaskColumnId(board.columns))
                    setCreateOpen(true)
                  }}
                >
                  <Plus className="size-4" /> Crear primera tarea
                </Button>
              }
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
          <div
            ref={boardScrollRef}
            className="scrollbar-thin grid h-full grid-rows-1 gap-3 overflow-x-auto p-3 sm:p-4"
            style={{ gridTemplateColumns: `repeat(${board.columns.length}, minmax(180px, 1fr))` }}
          >
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={grouped[column.id] ?? []}
                tasksById={tasksById}
                members={members}
                onOpenTask={openTaskDetail}
                onCreateTask={(columnId) => {
                  setCreateColumnId(columnId)
                  setCreateOpen(true)
                }}
                onEditColumn={canManage ? () => setColumnsOpen(true) : undefined}
              />
            ))}
          </div>
            <DragOverlay>
              {activeTask ? (
                <div style={{ width: activeWidth }}>
                  <TaskCardContent
                    task={activeTask}
                    members={members}
                    done={activeColumn?.isDone ?? false}
                    review={activeColumn ? isReviewColumn(activeColumn) : false}
                    dependencies={
                      activeColumn && isDependentsColumn(activeColumn) ? activeDependencies : []
                    }
                    dependents={activeColumn ? isDependentsColumn(activeColumn) : false}
                    overlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        board={board}
        members={members}
        tasks={tasks}
        defaultColumnId={createColumnId}
        suggestedLabels={labelOptions}
        onCreated={(task) => {
          const next = new URLSearchParams(params)
          next.set('task', task.id)
          setParams(next, { replace: true })
        }}
      />

      <TaskDetailSheet
        task={openTask}
        board={board}
        boardTasks={tasks}
        members={members}
        files={files}
        role={role}
        suggestedLabels={labelOptions}
        onClose={closeTaskDetail}
        onCloseAutoFocus={(event) => {
          const trigger = taskTrigger.current
          taskTrigger.current = null
          if (!trigger?.isConnected) return
          event.preventDefault()
          trigger.focus({ preventScroll: true })
        }}
        onTransferred={(moved, target) => {
          closeTaskDetail()
          navigate(`/w/${target.workspaceId}/boards/${target.boardId}?task=${moved.id}`)
        }}
      />

      <LabelManagerDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        board={board}
        tasks={tasks}
      />

      <ColumnManagerDialog
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        board={board}
        tasks={tasks}
      />

      <BoardDialog
        board={board}
        open={canManage && editingBoardId === board.id}
        onOpenChange={(open) => setEditingBoardId(open ? board.id : null)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar este tablero?"
        description="Se eliminarán todas sus tareas y comentarios. Esta acción no se puede deshacer."
        confirmLabel="Eliminar tablero"
        onConfirm={async () => {
          try {
            await container.boards.remove(workspace.id, board.id)
            toast.success('Tablero eliminado.')
            navigate(`/w/${workspace.id}/boards`)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el tablero.')
          }
        }}
      />
    </div>
  )
}
