import type { Priority } from '@/domain/entities/identity'
import { PRIORITY_META, PRIORITY_VALUES } from '@/domain/entities/identity'
import type {
  BoardColumn,
  BoardSummary,
  Task,
  TaskDraftInput,
} from '@/domain/entities/kanban'
import { defaultTaskColumnId, isDependentsColumn } from '@/domain/entities/kanban'
import { NotFoundError, ValidationError } from '@/domain/errors'
import { isDueSoon, isOverdue } from '@/lib/date'

const MAX_TITLE = 160
const MAX_DESCRIPTION = 4000
export const MAX_TASK_LABELS = 8
export const MAX_TASK_LABEL_LENGTH = 24
export const MAX_TASK_DEPENDENCIES = 10

const EMPTY_TASK_IDS: string[] = []

/** Limpia y deduplica las tareas relacionadas. */export function normalizeDependencyIds(ids: string[] | undefined | null): string[] {
  const unique = new Set<string>()
  for (const id of ids ?? []) {
    const trimmed = id.trim()
    if (trimmed) unique.add(trimmed)
  }
  if (unique.size > MAX_TASK_DEPENDENCIES) {
    throw new ValidationError(`Una tarea admite máximo ${MAX_TASK_DEPENDENCIES} relacionadas.`)
  }
  return [...unique]
}

/** Normaliza las etiquetas personalizadas de un tablero. */
export function normalizeBoardLabels(labels: string[] | undefined | null): string[] {
  const unique: string[] = []
  for (const raw of labels ?? []) {
    const label = raw.trim().toLowerCase()
    if (!label) continue
    if (label.length > MAX_TASK_LABEL_LENGTH) {
      throw new ValidationError(`Cada etiqueta admite máximo ${MAX_TASK_LABEL_LENGTH} caracteres.`)
    }
    if (!unique.includes(label)) unique.push(label)
  }
  if (unique.length > 50) {
    throw new ValidationError('El tablero admite máximo 50 etiquetas personalizadas.')
  }
  return unique
}

/**
 * Valida las tareas relacionadas: no pueden ser la propia tarea, deben existir
 * y no pueden estar completadas.
 */
export function validateTaskDependencies(
  ids: string[] | undefined | null,
  tasks: Task[],
  columns: BoardColumn[],
  selfId?: string,
): string[] {
  const normalized = normalizeDependencyIds(ids)
  if (normalized.length === 0) return normalized

  const byId = new Map(tasks.map((task) => [task.id, task]))
  for (const id of normalized) {
    if (selfId && id === selfId) {
      throw new ValidationError('Una tarea no puede depender de sí misma.')
    }
    const related = byId.get(id)
    if (!related) throw new ValidationError('La tarea relacionada no existe.')
    if (isTaskCompleted(related, columns)) {
      throw new ValidationError('No puedes relacionar una tarea completada.')
    }
  }
  return normalized
}

export function validateTaskTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new ValidationError('El título de la tarea es obligatorio.')
  if (trimmed.length > MAX_TITLE) {
    throw new ValidationError(`El título no puede superar los ${MAX_TITLE} caracteres.`)
  }
  return trimmed
}

export function validateDescription(description: string | undefined): string {
  const trimmed = (description ?? '').trim()
  if (trimmed.length > MAX_DESCRIPTION) {
    throw new ValidationError(`La descripción no puede superar los ${MAX_DESCRIPTION} caracteres.`)
  }
  return trimmed
}

export function validatePriority(priority: string | undefined): Priority {
  if (priority === undefined) return 'medium'
  if (!(PRIORITY_VALUES as readonly string[]).includes(priority)) {
    throw new ValidationError('La prioridad seleccionada no es válida.')
  }
  return priority as Priority
}

/** `dueDate` debe ser una fecha ISO sin hora válida (YYYY-MM-DD). */
export function validateDueDate(dueDate: string | null | undefined): string | null {
  if (dueDate === null || dueDate === undefined || dueDate === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new ValidationError('La fecha límite debe tener el formato AAAA-MM-DD.')
  }
  const [year, month, day] = dueDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new ValidationError('La fecha límite no es una fecha válida.')
  }
  return dueDate
}

export function uniqueIds(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))]
}

export function normalizeLabels(labels: string[] | undefined): string[] {
  const normalized = uniqueIds(labels?.map((label) => label.trim().toLowerCase()))
  if (normalized.length > MAX_TASK_LABELS) {
    throw new ValidationError(`Puedes añadir como máximo ${MAX_TASK_LABELS} etiquetas.`)
  }
  for (const label of normalized) {
    if (label.length > MAX_TASK_LABEL_LENGTH) {
      throw new ValidationError(
        `Cada etiqueta debe tener máximo ${MAX_TASK_LABEL_LENGTH} caracteres.`,
      )
    }
  }
  return normalized
}

/** Etiquetas ya usadas en las tareas, para ofrecerlas como sugerencias. */
export function collectTaskLabels(tasks: Task[]): string[] {
  const labels = new Set<string>()
  for (const task of tasks) {
    for (const label of task.labels) labels.add(label)
  }
  return [...labels]
}

export interface NewTaskOptions {
  id: string
  order?: number
  now?: string
}

export function newTask(input: TaskDraftInput, options: NewTaskOptions): Task {
  const now = options.now ?? new Date().toISOString()
  if (!options.id) throw new ValidationError('La tarea necesita un identificador.')
  if (!input.columnId.trim()) throw new ValidationError('Selecciona una columna para la tarea.')
  if (!input.createdBy) throw new ValidationError('La tarea necesita un autor.')

  return {
    id: options.id,
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    title: validateTaskTitle(input.title),
    description: validateDescription(input.description),
    columnId: input.columnId,
    order: options.order ?? 0,
    assigneeIds: uniqueIds(input.assigneeIds),
    reviewerId: input.reviewerId?.trim() || null,
    dependsOnTaskIds: normalizeDependencyIds(input.dependsOnTaskIds),
    priority: validatePriority(input.priority),
    dueDate: validateDueDate(input.dueDate),
    labels: normalizeLabels(input.labels),
    attachmentIds: uniqueIds(input.attachmentIds),
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

function sortByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export function nextTaskOrder(tasks: Task[], columnId: string): number {
  const columnTasks = tasks.filter((task) => task.columnId === columnId)
  if (columnTasks.length === 0) return 0
  return Math.max(...columnTasks.map((task) => task.order)) + 1
}

export interface TransferTaskOptions {
  id: string
  workspaceId: string
  boardId: string
  columnId: string
  order: number
  actorId: string
  isDoneColumn?: boolean
  assigneeIds?: string[]
  attachmentIds?: string[]
  reviewerId?: string | null
  now?: string
}

/**
 * Construye la tarea resultante de migrarla a otro tablero.
 * El autor pasa a ser quien realiza la migración porque las reglas de
 * Firestore exigen que `createdBy` sea el usuario autenticado.
 */
export function transferTask(task: Task, options: TransferTaskOptions): Task {
  const now = options.now ?? new Date().toISOString()
  if (!options.actorId) throw new ValidationError('La tarea necesita un autor.')
  if (!options.columnId.trim()) throw new ValidationError('Selecciona una columna de destino.')
  return {
    ...task,
    id: options.id,
    workspaceId: options.workspaceId,
    boardId: options.boardId,
    columnId: options.columnId,
    order: options.order,
    assigneeIds: uniqueIds(options.assigneeIds ?? task.assigneeIds),
    attachmentIds: uniqueIds(options.attachmentIds ?? task.attachmentIds),
    reviewerId:
      options.reviewerId !== undefined ? options.reviewerId : task.reviewerId,
    dependsOnTaskIds: [],
    createdBy: options.actorId,
    createdAt: now,
    updatedAt: now,
    completedAt: options.isDoneColumn ? now : null,
  }
}

export function isTaskCompleted(task: Task, columns: BoardColumn[]): boolean {
  if (task.completedAt) return true
  return columns.find((column) => column.id === task.columnId)?.isDone ?? false
}

/**
 * Mueve una tarea a una columna/índice y reindexa las columnas afectadas.
 * Devuelve un nuevo array; las tareas no afectadas conservan su referencia.
 */
export function moveTask(
  tasks: Task[],
  taskId: string,
  toColumnId: string,
  toIndex: number,
  columns: BoardColumn[],
  now: string = new Date().toISOString(),
): Task[] {
  const task = tasks.find((candidate) => candidate.id === taskId)
  if (!task) throw new NotFoundError('La tarea no existe.')
  const targetColumn = columns.find((column) => column.id === toColumnId)
  if (!targetColumn) throw new ValidationError('La columna de destino no existe.')

  const fromColumnId = task.columnId
  const sourceTasks = sortByOrder(tasks.filter((candidate) => candidate.columnId === fromColumnId))
  const targetTasks =
    fromColumnId === toColumnId
      ? sourceTasks
      : sortByOrder(tasks.filter((candidate) => candidate.columnId === toColumnId))

  const movingIndex = sourceTasks.findIndex((candidate) => candidate.id === taskId)
  if (movingIndex === -1) throw new NotFoundError('La tarea no existe.')
  const [moving] = sourceTasks.splice(movingIndex, 1)

  const safeIndex = Math.max(0, Math.min(toIndex, targetTasks.length))
  targetTasks.splice(safeIndex, 0, moving)

  const updated = new Map<string, Task>()
  const commit = (list: Task[], column: BoardColumn, isTarget: boolean) => {
    list.forEach((candidate, index) => {
      const isMoving = candidate.id === taskId
      let completedAt = candidate.completedAt
      if (isMoving) {
        // Al entrar en una columna final se marca; al salir se limpia.
        completedAt = column.isDone ? (candidate.completedAt ?? now) : null
      }
      // El responsable de revisión desaparece al llegar a una columna final.
      const reviewerId = isMoving && column.isDone ? null : candidate.reviewerId
      // La relación con otras tareas solo existe mientras la tarea está en Dependientes.
      const dependsOnTaskIds =
        isMoving && !isDependentsColumn(targetColumn)
          ? EMPTY_TASK_IDS
          : candidate.dependsOnTaskIds
      const needsUpdate =
        candidate.order !== index ||
        (isMoving && candidate.completedAt !== completedAt) ||
        candidate.reviewerId !== reviewerId ||
        candidate.dependsOnTaskIds !== dependsOnTaskIds ||
        (isMoving && candidate.updatedAt !== now) ||
        (isTarget && isMoving && candidate.columnId !== column.id)
      if (!needsUpdate) return
      updated.set(candidate.id, {
        ...candidate,
        columnId: column.id,
        order: index,
        completedAt,
        reviewerId,
        dependsOnTaskIds,
        updatedAt: isMoving ? now : candidate.updatedAt,
      })
    })
  }

  const sourceColumn = columns.find((column) => column.id === fromColumnId)
  if (sourceColumn && fromColumnId !== toColumnId) commit(sourceTasks, sourceColumn, false)
  commit(targetTasks, targetColumn, true)

  // Al completar una tarea, sus dependientes salen de "Dependientes" hacia la columna inicial.
  if (targetColumn.isDone && !task.completedAt) {
    releaseDependents(tasks, updated, taskId, columns, now)
  }

  return tasks.map((candidate) => updated.get(candidate.id) ?? candidate)
}

function releaseDependents(
  tasks: Task[],
  updated: Map<string, Task>,
  completedTaskId: string,
  columns: BoardColumn[],
  now: string,
): void {
  const columnById = new Map(columns.map((column) => [column.id, column]))
  const dependentColumn = columns.find(isDependentsColumn)
  if (!dependentColumn) return

  const byId = new Map(tasks.map((task) => [task.id, task]))
  const resolve = (taskId: string): Task | null =>
    updated.get(taskId) ?? byId.get(taskId) ?? null

  const dependents = tasks
    .filter(
      (candidate) =>
        candidate.columnId === dependentColumn.id &&
        candidate.dependsOnTaskIds.includes(completedTaskId) &&
        candidate.id !== completedTaskId,
    )
    .sort((a, b) => a.order - b.order)
  if (dependents.length === 0) return

  const targetColumnId = defaultTaskColumnId(columns)
  const currentOrders = tasks
    .map((candidate) => updated.get(candidate.id) ?? candidate)
    .filter((candidate) => candidate.columnId === targetColumnId)
    .map((candidate) => candidate.order)
  let nextOrder = currentOrders.length > 0 ? Math.max(...currentOrders) + 1 : 0

  for (const dependent of dependents) {
    // Si la columna inicial no existe o es la misma de dependientes, no hacemos nada.
    if (targetColumnId === dependentColumn.id || !columnById.has(targetColumnId)) continue

    // Solo se libera cuando TODAS las tareas relacionadas están completadas.
    const allDone = dependent.dependsOnTaskIds.every((taskId) => {
      const related = resolve(taskId)
      return !related || isTaskCompleted(related, columns)
    })
    if (!allDone) continue

    updated.set(dependent.id, {
      ...dependent,
      columnId: targetColumnId,
      order: nextOrder,
      completedAt: null,
      dependsOnTaskIds: [],
      updatedAt: now,
    })
    nextOrder += 1
  }
}

export function summarizeBoard(
  tasks: Task[],
  columns: BoardColumn[],
  now: Date = new Date(),
): BoardSummary {
  const total = tasks.length
  const completed = tasks.filter((task) => isTaskCompleted(task, columns)).length
  const open = tasks.filter(
    (task) => !isTaskCompleted(task, columns) && task.priority !== 'paused',
  ).length
  const overdue = tasks.filter(
    (task) =>
      !isTaskCompleted(task, columns) &&
      task.priority !== 'paused' &&
      isOverdue(task.dueDate, now),
  ).length
  const byColumn: Record<string, number> = {}
  for (const column of columns) byColumn[column.id] = 0
  for (const task of tasks) {
    byColumn[task.columnId] = (byColumn[task.columnId] ?? 0) + 1
  }
  return {
    total,
    completed,
    open,
    overdue,
    byColumn,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

export interface TaskFilters {
  query?: string
  assigneeId?: string | null
  priority?: Priority | null
  label?: string | null
  onlyMine?: string | null
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const query = filters.query?.trim().toLowerCase()
  return tasks.filter((task) => {
    if (query) {
      const haystack = `${task.title} ${task.description} ${task.labels.join(' ')}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (filters.assigneeId && !task.assigneeIds.includes(filters.assigneeId)) return false
    if (filters.priority && task.priority !== filters.priority) return false
    if (filters.label && !task.labels.includes(filters.label)) return false
    if (filters.onlyMine && !task.assigneeIds.includes(filters.onlyMine)) return false
    return true
  })
}

export function sortBoardTasks(tasks: Task[], columns: BoardColumn[]): Record<string, Task[]> {
  const grouped: Record<string, Task[]> = {}
  for (const column of columns) {
    grouped[column.id] = tasks
      .filter((task) => task.columnId === column.id)
      .sort(
        (a, b) =>
          priorityWeight(b.priority) - priorityWeight(a.priority) ||
          a.order - b.order ||
          a.createdAt.localeCompare(b.createdAt),
      )
  }
  return grouped
}

export function tasksDueSoon(tasks: Task[], columns: BoardColumn[], now: Date, days = 7): Task[] {
  return tasks
    .filter(
      (task) =>
        !isTaskCompleted(task, columns) && isDueSoon(task.dueDate, now, days) && task.dueDate,
    )
    .sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0
      return a.dueDate.localeCompare(b.dueDate) || priorityWeight(b.priority) - priorityWeight(a.priority)
    })
}

export function priorityWeight(priority: Priority): number {
  return PRIORITY_VALUES.indexOf(priority)
}

export const PRIORITY_OPTIONS = PRIORITY_VALUES.map((value) => ({
  value,
  label: PRIORITY_META[value].label,
}))
