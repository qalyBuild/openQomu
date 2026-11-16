import { Link2, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { BoardColumn, Task } from '@/domain/entities/kanban'
import { cn } from '@/lib/utils'

interface TaskDependencyPickerProps {
  tasks: Task[]
  columns: BoardColumn[]
  value: string[]
  excludeTaskId?: string
  onChange: (ids: string[]) => void
  disabled?: boolean
}

/**
 * Selección múltiple de tareas relacionadas.
 * Solo ofrece tareas abiertas: una tarea completada no puede ser entrada.
 */
export function TaskDependencyPicker({
  tasks,
  columns,
  value,
  excludeTaskId,
  onChange,
  disabled = false,
}: TaskDependencyPickerProps) {
  const doneColumns = new Set(columns.filter((column) => column.isDone).map((column) => column.id))
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const selected = value
    .map((id) => byId.get(id))
    .filter((task): task is Task => Boolean(task))
  const candidates = tasks.filter(
    (task) =>
      task.id !== excludeTaskId && !task.completedAt && !doneColumns.has(task.columnId),
  )

  const toggle = (taskId: string) => {
    if (disabled) return
    onChange(value.includes(taskId) ? value.filter((id) => id !== taskId) : [...value, taskId])
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((task) => (
            <span
              key={task.id}
              className="flex max-w-full items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.62rem] text-amber-700 dark:text-amber-300"
            >
              <Link2 className="size-2.5 shrink-0" />
              <span className="max-w-40 truncate">{task.title}</span>
              {!disabled && (
                <button
                  type="button"
                  className="shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100"
                  onClick={() => toggle(task.id)}
                  aria-label={`Quitar relación con ${task.title}`}
                >
                  <X className="size-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="scrollbar-thin max-h-40 overflow-y-auto rounded-lg border bg-background/60">
        {candidates.length === 0 ? (
          <p className="px-2.5 py-3 text-center text-[0.65rem] text-muted-foreground">
            No hay tareas abiertas para relacionar.
          </p>
        ) : (
          candidates.map((task) => {
            const checked = value.includes(task.id)
            const columnName = columns.find((column) => column.id === task.columnId)?.name
            return (
              <label
                key={task.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-b px-2 py-1.5 last:border-b-0 transition-colors',
                  checked ? 'bg-amber-500/10' : 'hover:bg-accent/40',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => toggle(task.id)}
                  className="size-3.5"
                />
                <span className="min-w-0 flex-1 truncate text-[0.7rem]">{task.title}</span>
                {columnName && (
                  <span className="shrink-0 text-[0.58rem] text-muted-foreground">
                    {columnName}
                  </span>
                )}
              </label>
            )
          })
        )}
      </div>
      <p className="text-[0.6rem] leading-relaxed text-muted-foreground">
        Pasa a «Por hacer» cuando todas las relacionadas estén hechas.
      </p>
    </div>
  )
}
