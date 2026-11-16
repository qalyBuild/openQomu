import { CalendarDays, Flag } from 'lucide-react'
import type { Priority } from '@/domain/entities/identity'
import { PRIORITY_META } from '@/domain/entities/identity'
import { formatDueDate, isOverdue } from '@/lib/date'
import { cn } from '@/lib/utils'

export function PriorityBadge({
  priority,
  className,
  compact = false,
}: {
  priority: Priority
  className?: string
  compact?: boolean
}) {
  const meta = PRIORITY_META[priority]
  if (compact) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
        title={`Prioridad ${meta.label.toLowerCase()}`}
      >
        <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
        {meta.label}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium',
        meta.badge,
        className,
      )}
    >
      <Flag className="size-3" />
      {meta.label}
    </span>
  )
}

export function DueDateBadge({
  dueDate,
  className,
  showIcon = true,
}: {
  dueDate: string | null
  className?: string
  showIcon?: boolean
}) {
  if (!dueDate) return null
  const overdue = isOverdue(dueDate)
  const dueToday = formatDueDate(dueDate) === 'Hoy'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[0.7rem] font-medium',
        overdue
          ? 'text-rose-500'
          : dueToday
            ? 'text-amber-500'
            : 'text-muted-foreground',
        className,
      )}
      title={`Vence el ${dueDate}`}
    >
      {showIcon && <CalendarDays className="size-3" />}
      {overdue ? `Venció ${formatDueDate(dueDate).toLowerCase()}` : formatDueDate(dueDate)}
    </span>
  )
}
