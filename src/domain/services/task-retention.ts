import type { Task } from '@/domain/entities/kanban'
import { addDays, daysBetween, formatDate } from '@/lib/date'

/** Días que una tarea terminada permanece en Firestore antes de purgarse. */
export const TASK_RETENTION_DAYS = 15

export function taskDeletionDate(task: Pick<Task, 'completedAt'>): Date | null {
  if (!task.completedAt) return null
  return addDays(task.completedAt, TASK_RETENTION_DAYS)
}

/** Días naturales que quedan hasta el borrado; 0 significa que se elimina hoy. */
export function daysUntilTaskDeletion(
  task: Pick<Task, 'completedAt'>,
  now: Date = new Date(),
): number | null {
  const deletionDate = taskDeletionDate(task)
  if (!deletionDate) return null
  return Math.max(0, daysBetween(deletionDate, now))
}

/** Texto para el detalle de la tarea. `null` si todavía no está terminada. */
export function formatTaskDeletionNotice(
  task: Pick<Task, 'completedAt'>,
  now: Date = new Date(),
): string | null {
  const deletionDate = taskDeletionDate(task)
  const days = daysUntilTaskDeletion(task, now)
  if (!deletionDate || days === null) return null
  if (days === 0) return 'Se elimina hoy'
  const date = formatDate(deletionDate.toISOString())
  if (days === 1) return `Se elimina mañana (${date})`
  return `Se elimina el ${date} · quedan ${days} días`
}
