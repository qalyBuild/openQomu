import type { DashboardMetrics, TrendDatum } from '@/domain/entities/analytics'
import type { Member } from '@/domain/entities/identity'
import { PRIORITY_META, PRIORITY_VALUES } from '@/domain/entities/identity'
import { isBoardMuted, isReviewColumn, type Board, type BoardColumn, type Task } from '@/domain/entities/kanban'
import type { Priority } from '@/domain/entities/identity'
import { addDays, dayKey, isOverdue } from '@/lib/date'
import { isTaskCompleted, tasksDueSoon } from './task-service'

/** Los tableros inactivos conservan sus datos históricos, pero no aportan tareas pendientes. */
export function dashboardTasks(tasks: Task[], boards: Board[]): Task[] {
  const byId = new Map(boards.map((board) => [board.id, board]))
  return tasks.filter((task) => {
    const board = byId.get(task.boardId)
    return !board || !isBoardMuted(board.status) || isTaskCompleted(task, board.columns)
  })
}

export function buildCompletionTrend(
  tasks: Task[],
  now: Date = new Date(),
  days = 14,
): TrendDatum[] {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(now, index - (days - 1))
    const key = dayKey(date)
    return {
      date: key,
      label: new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' }).format(date),
      created: tasks.filter((task) => dayKey(task.createdAt) === key).length,
      completed: tasks.filter(
        (task) => task.completedAt !== null && dayKey(task.completedAt) === key,
      ).length,
    }
  })
}

export function buildDashboard(
  tasks: Task[],
  columns: BoardColumn[],
  members: Member[],
  now: Date = new Date(),
): DashboardMetrics {
  const completed = tasks.filter((task) => isTaskCompleted(task, columns))
  const openTasks = tasks.filter((task) => !isTaskCompleted(task, columns))
  // Las tareas en pausa no computan como abiertas ni generan avisos de vencimiento.
  const activeOpenTasks = openTasks.filter((task) => task.priority !== 'paused')
  const open = activeOpenTasks.length
  const overdue = activeOpenTasks.filter((task) => isOverdue(task.dueDate, now))
  const reviewColumnIds = new Set(columns.filter(isReviewColumn).map((column) => column.id))
  const waitingReview = activeOpenTasks.filter((task) => reviewColumnIds.has(task.columnId)).length
  const urgentOpen = activeOpenTasks.filter((task) => task.priority === 'urgent').length

  const byStatus = columns.map((column) => ({
    columnId: column.id,
    label: column.name,
    count: tasks.filter((task) => task.columnId === column.id).length,
    color: column.color,
  }))

  const byPriority = PRIORITY_VALUES.map((priority: Priority) => ({
    priority,
    label: PRIORITY_META[priority].label,
    count: tasks.filter((task) => task.priority === priority).length,
    color: PRIORITY_META[priority].color,
  }))

  const workload = members
    .map((member) => {
      const assigned = tasks.filter((task) => task.assigneeIds.includes(member.uid))
      const done = assigned.filter((task) => isTaskCompleted(task, columns)).length
      const paused = assigned.filter((task) => task.priority === 'paused').length
      return {
        uid: member.uid,
        name: member.displayName,
        photoURL: member.photoURL,
        total: assigned.length,
        completed: done,
        open: assigned.length - done - paused,
      }
    })
    .sort((a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name))

  return {
    total: tasks.length,
    completed: completed.length,
    open,
    overdue: overdue.length,
    waitingReview,
    urgentOpen,
    dueSoon: tasksDueSoon(
      tasks.filter((task) => task.priority !== 'paused'),
      columns,
      now,
      7,
    ),
    completionRate: tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100),
    byStatus,
    byPriority,
    trend: buildCompletionTrend(tasks, now, 14),
    workload,
    updatedAt: now.toISOString(),
  }
}
