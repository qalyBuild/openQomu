import { Fragment, useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MoreHorizontal, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Divider } from '@/components/ui/divider'
import { isDependentsColumn, isReviewColumn, type BoardColumn, type Task } from '@/domain/entities/kanban'
import {
  PRIORITY_META,
  type Member,
  type Priority,
} from '@/domain/entities/identity'
import { cn } from '@/lib/utils'
import { filterTasks } from '@/domain/services/task-service'
import { TaskCard } from './task-card'

export function KanbanColumn({
  column,
  tasks,
  tasksById,
  members,
  onOpenTask,
  onCreateTask,
  onEditColumn,
}: {
  column: BoardColumn
  tasks: Task[]
  tasksById: Map<string, Task>
  members: Member[]
  onOpenTask: (task: Task, trigger: HTMLElement) => void
  onCreateTask: (columnId: string) => void
  onEditColumn?: (column: BoardColumn) => void
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const visibleTasks = useMemo(() => filterTasks(tasks, { query }), [tasks, query])
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  })

  const groups = useMemo(() => {
    const byPriority = new Map<Priority, Task[]>()
    for (const task of visibleTasks) {
      const bucket = byPriority.get(task.priority)
      if (bucket) bucket.push(task)
      else byPriority.set(task.priority, [task])
    }
    return (['urgent', 'high', 'medium', 'low', 'paused'] satisfies Priority[])
      .filter((priority) => byPriority.has(priority))
      .map((priority) => ({ priority, tasks: byPriority.get(priority) ?? [] }))
  }, [visibleTasks])

  return (
    <div
      ref={setNodeRef}
      data-column-id={column.id}
      data-glass-column
      data-drag-over={isOver || undefined}
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col rounded-2xl border bg-muted/30 transition-colors',
        isOver && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div
          data-glass-surface="chrome"
          data-glass-chrome="column"
          className="kanban-column-heading sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5"
        >
          <span className="size-2 shrink-0 rounded-full" style={{ background: column.color }} />
          <span className="kanban-column-name min-w-0 wrap-break-word text-xs font-semibold uppercase tracking-[0.08em]">
            {column.name.split('/').map((part, index) => (
              <Fragment key={index}>
                {index > 0 && <>/<wbr /></>}
                {part}
              </Fragment>
            ))}
          </span>
          <Badge variant="secondary" className="h-4 min-w-4 shrink-0 px-1 text-[0.6rem]">
            {tasks.length}
          </Badge>
          <div className="ms-auto flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              aria-label={`Buscar tareas en ${column.name}`}
              aria-expanded={searchOpen}
              onClick={() => { setSearchOpen((open) => !open); setQuery('') }}
            >
              <Search className="size-3.5" />
            </Button>
            {onEditColumn && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={() => onEditColumn(column)}
                aria-label={`Editar columna ${column.name}`}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={() => onCreateTask(column.id)}
              aria-label={`Añadir tarea a ${column.name}`}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        {searchOpen && (
          <div className="flex items-center gap-1 px-2 pb-2">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') { setQuery(''); setSearchOpen(false) } }}
              aria-label={`Buscar tareas en ${column.name}`}
              placeholder="Buscar tareas…"
              className="h-8 text-xs"
            />
            {query && <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X className="size-3.5" /></Button>}
          </div>
        )}

        <div className="space-y-2 px-2 pb-2">
          <SortableContext items={visibleTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {groups.map((group) => (
              <div key={group.priority} className="space-y-2">
                <Divider variant="middle" className="px-0.5 pt-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: PRIORITY_META[group.priority].color }}
                    />
                    Prioridad {PRIORITY_META[group.priority].label}
                  </span>
                </Divider>
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    members={members}
                    done={column.isDone}
                    review={isReviewColumn(column)}
                    dependents={isDependentsColumn(column)}
                    dependencies={
                      isDependentsColumn(column)
                        ? task.dependsOnTaskIds
                            .map((id) => tasksById.get(id))
                            .filter((item): item is Task => Boolean(item))
                        : []
                    }
                    onClick={(trigger) => onOpenTask(task, trigger)}
                  />
                ))}
              </div>
            ))}
          </SortableContext>
          {visibleTasks.length === 0 && (
            <div className="grid h-24 place-items-center rounded-xl border border-dashed text-[0.68rem] text-muted-foreground">
              {query.trim() ? 'No hay tareas que coincidan' : 'Suelta una tarea aquí'}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onCreateTask(column.id)}
          >
            <Plus className="size-3.5" /> Añadir tarea
          </Button>
        </div>
      </div>
    </div>
  )
}
