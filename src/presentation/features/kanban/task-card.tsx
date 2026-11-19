import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, CheckCircle2, Link2, Paperclip } from 'lucide-react'
import type { Task } from '@/domain/entities/kanban'
import type { Member } from '@/domain/entities/identity'
import { PRIORITY_META } from '@/domain/entities/identity'
import { isOverdue } from '@/lib/date'
import { cn } from '@/lib/utils'
import { AvatarStack } from '@/presentation/components/common/user-avatar'

export function TaskCardContent({
  task,
  members,
  done = false,
  review = false,
  overlay = false,
  dependencies = [],
  dependents = false,
}: {
  task: Task
  members: Member[]
  done?: boolean
  review?: boolean
  overlay?: boolean
  dependencies?: Task[]
  dependents?: boolean
}) {
  const people = members
    .filter((member) =>
      review ? member.uid === task.reviewerId : task.assigneeIds.includes(member.uid),
    )
    .map((member) => ({
      id: member.uid,
      displayName: member.displayName,
      photoURL: member.photoURL,
    }))

  return (
    <div
      className={cn(
        'group/card rounded-xl border bg-card p-3 text-start shadow-sm transition-all',
        overlay
          ? 'rotate-2 border-primary/40 shadow-xl shadow-primary/10'
          : 'hover:border-primary/25 hover:shadow-md',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 size-2 shrink-0 rounded-full"
          style={{ background: PRIORITY_META[task.priority].color }}
          title={`Prioridad ${PRIORITY_META[task.priority].label}`}
        />
        <p
          className={cn(
            'min-w-0 flex-1 text-[0.84rem] font-medium leading-snug tracking-[-0.01em]',
            done && 'text-muted-foreground line-through decoration-muted-foreground/40',
          )}
        >
          {task.title}
        </p>
        {done && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />}
      </div>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 ps-4">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="rounded-md bg-accent px-1.5 py-0.5 text-[0.6rem] font-medium text-accent-foreground"
            >
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="text-[0.6rem] text-muted-foreground">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {dependencies.length > 0 ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 ps-1.5 text-[0.62rem] text-amber-700 dark:text-amber-300">
          <Link2 className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0">
            Depende de{' '}
            {dependencies.slice(0, 2).map((dependency, index) => (
              <span key={dependency.id}>
                {index > 0 && ', '}
                <span
                  className={cn(
                    'font-medium',
                    dependency.completedAt && 'line-through decoration-amber-500/40',
                  )}
                >
                  {dependency.title}
                </span>
              </span>
            ))}
            {dependencies.length > 2 && ` +${dependencies.length - 2}`}
          </span>
        </div>
      ) : dependents ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-amber-500/40 px-2 py-1 ps-1.5 text-[0.62rem] text-muted-foreground">
          <Link2 className="size-3 shrink-0" />
          Sin tareas relacionadas
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2 ps-4">
        {task.dueDate && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[0.62rem] font-medium',
              !done && isOverdue(task.dueDate)
                ? 'text-rose-500'
                : 'text-muted-foreground',
            )}
          >
            <CalendarDays className="size-3" />
            {formatShortDue(task.dueDate)}
          </span>
        )}
        {task.attachmentIds.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[0.62rem] text-muted-foreground">
            <Paperclip className="size-3" /> {task.attachmentIds.length}
          </span>
        )}
        <span className="ms-auto">
          <AvatarStack people={people} size="xs" max={3} />
        </span>
      </div>
    </div>
  )
}

function formatShortDue(dueDate: string): string {
  const [year, month, day] = dueDate.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day),
  )
}

export function TaskCard({
  task,
  members,
  done,
  review = false,
  dependencies = [],
  dependents = false,
  onClick,
}: {
  task: Task
  members: Member[]
  done: boolean
  review?: boolean
  dependencies?: Task[]
  dependents?: boolean
  onClick: (trigger: HTMLElement) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  return (
    <div
      ref={setNodeRef}
      data-task-id={task.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={(event) => {
        if (isDragging) return
        const target = event.target as HTMLElement
        if (target.closest('button, a')) return
        onClick(event.currentTarget)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget && !isDragging) {
          event.preventDefault()
          onClick(event.currentTarget)
          return
        }
        listeners?.onKeyDown?.(event)
      }}
      className="cursor-grab touch-manipulation active:cursor-grabbing"
      aria-label={`Tarea: ${task.title}`}
    >
      <TaskCardContent
        task={task}
        members={members}
        done={done}
        review={review}
        dependencies={dependencies}
        dependents={dependents}
      />
    </div>
  )
}
