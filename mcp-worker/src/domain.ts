export const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent', 'paused'] as const
export type Priority = (typeof PRIORITY_VALUES)[number]

export const TASK_LABELS = [
  'diseño',
  'producto',
  'frontend',
  'backend',
  'bug',
  'documentación',
  'marketing',
  'equipo',
] as const

export interface Workspace {
  id: string
  name: string
  icon: string
  description: string
  ownerId: string
}

export interface Member {
  uid: string
  role: 'owner' | 'admin' | 'member'
  displayName: string
  photoURL: string | null
}

export interface BoardColumn {
  id: string
  name: string
  color: string
  isDone: boolean
}

export interface Board {
  id: string
  workspaceId: string
  name: string
  description: string
  columns: BoardColumn[]
}

export interface Task {
  id: string
  workspaceId: string
  boardId: string
  title: string
  description: string
  columnId: string
  order: number
  assigneeIds: string[]
  reviewerId: string | null
  /** Tareas de las que depende; solo aplica en la columna Dependientes. */
  dependsOnTaskIds: string[]
  priority: Priority
  dueDate: string | null
  labels: string[]
  attachmentIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface TaskComment {
  id: string
  workspaceId: string
  boardId: string
  taskId: string
  authorId: string
  authorName: string
  authorPhotoURL: string | null
  body: string
  createdAt: string
}

export class ValidationError extends Error {}
export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export const DEPENDENTS_COLUMN_ID = 'dependents'
export const MAX_TASK_DEPENDENCIES = 10

const EMPTY_TASK_IDS: string[] = []

export function isDependentsColumn(column: Pick<BoardColumn, 'id' | 'name'>): boolean {
  return column.id === DEPENDENTS_COLUMN_ID || /dependiente/i.test(column.name)
}

export function defaultTaskColumnId(columns: BoardColumn[]): string {
  const first =
    columns.find((column) => column.id === 'todo' && !isDependentsColumn(column)) ??
    columns.find((column) => !isDependentsColumn(column)) ??
    columns[0]
  return first?.id ?? 'todo'
}

function resolveDependencyIds(data: Record<string, unknown>): string[] {
  const list = asStringArray(data.dependsOnTaskIds).filter(Boolean)
  if (list.length > 0) return list
  // Compatibilidad con el campo único anterior.
  const legacy = asNullableString(data.dependsOnTaskId)
  return legacy ? [legacy] : []
}

/**
 * Normaliza y valida las tareas relacionadas: no pueden ser la propia tarea,
 * deben existir y no pueden estar completadas.
 */
export function validateDependencies(
  ids: string[] | undefined,
  tasks: Task[],
  columns: BoardColumn[],
  selfId?: string,
): string[] {
  const unique = [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))]
  if (unique.length > MAX_TASK_DEPENDENCIES) {
    throw new ValidationError(`Una tarea admite máximo ${MAX_TASK_DEPENDENCIES} relacionadas.`)
  }
  if (unique.length === 0) return unique

  const byId = new Map(tasks.map((task) => [task.id, task]))
  const doneColumns = new Set(
    columns.filter((column) => column.isDone).map((column) => column.id),
  )
  for (const id of unique) {
    if (selfId && id === selfId) {
      throw new ValidationError('Una tarea no puede depender de sí misma.')
    }
    const related = byId.get(id)
    if (!related) throw new ValidationError('La tarea relacionada no existe.')
    if (related.completedAt || doneColumns.has(related.columnId)) {
      throw new ValidationError('No puedes relacionar una tarea completada.')
    }
  }
  return unique
}

function asBoolean(value: unknown): boolean {
  return value === true
}

export function mapWorkspace(id: string, data: Record<string, unknown>): Workspace {
  return {
    id,
    name: asString(data.name, 'Espacio'),
    icon: asString(data.icon, '🪐'),
    description: asString(data.description),
    ownerId: asString(data.ownerId),
  }
}

export function mapMember(id: string, data: Record<string, unknown>): Member {
  const role = data.role
  return {
    uid: asString(data.uid, id),
    role: role === 'owner' || role === 'admin' ? role : 'member',
    displayName: asString(data.displayName, 'Miembro'),
    photoURL: asNullableString(data.photoURL),
  }
}

export function mapBoard(
  id: string,
  workspaceId: string,
  data: Record<string, unknown>,
): Board {
  const rawColumns = Array.isArray(data.columns) ? data.columns : []
  const columns: BoardColumn[] = rawColumns.map((entry) => {
    const column = (entry ?? {}) as Record<string, unknown>
    return {
      id: asString(column.id, 'todo'),
      name: asString(column.name, 'Sin nombre'),
      color: asString(column.color, '#94a3b8'),
      isDone: asBoolean(column.isDone),
    }
  })
  return {
    id,
    workspaceId,
    name: asString(data.name, 'Tablero'),
    description: asString(data.description),
    columns:
      columns.length > 0
        ? columns
        : [{ id: 'todo', name: 'Por hacer', color: '#94a3b8', isDone: false }],
  }
}

export function mapTask(
  id: string,
  workspaceId: string,
  boardId: string,
  data: Record<string, unknown>,
): Task {
  const priority = data.priority
  return {
    id,
    workspaceId,
    boardId,
    title: asString(data.title, 'Sin título'),
    description: asString(data.description),
    columnId: asString(data.columnId, 'todo'),
    order: asNumber(data.order),
    assigneeIds: asStringArray(data.assigneeIds),
    reviewerId: asNullableString(data.reviewerId),
    dependsOnTaskIds: resolveDependencyIds(data),
    priority: (PRIORITY_VALUES as readonly string[]).includes(String(priority))
      ? (priority as Priority)
      : 'medium',
    dueDate: asNullableString(data.dueDate),
    labels: asStringArray(data.labels),
    attachmentIds: asStringArray(data.attachmentIds),
    createdBy: asString(data.createdBy),
    createdAt: asString(data.createdAt, new Date().toISOString()),
    updatedAt: asString(data.updatedAt, new Date().toISOString()),
    completedAt: asNullableString(data.completedAt),
  }
}

export function mapComment(
  id: string,
  workspaceId: string,
  boardId: string,
  taskId: string,
  data: Record<string, unknown>,
): TaskComment {
  return {
    id,
    workspaceId,
    boardId,
    taskId,
    authorId: asString(data.authorId),
    authorName: asString(data.authorName, 'Miembro'),
    authorPhotoURL: asNullableString(data.authorPhotoURL),
    body: asString(data.body),
    createdAt: asString(data.createdAt, new Date().toISOString()),
  }
}

export function uniqueIds(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
}

export function validateTitle(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('El título es obligatorio.')
  const title = value.trim()
  if (!title) throw new ValidationError('El título es obligatorio.')
  if (title.length > 160) throw new ValidationError('El título no puede superar 160 caracteres.')
  return title
}

export function validateDescription(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ValidationError('La descripción no es válida.')
  const description = value.trim()
  if (description.length > 4000) {
    throw new ValidationError('La descripción no puede superar 4000 caracteres.')
  }
  return description
}

export function validatePriority(value: unknown): Priority {
  if (value === undefined) return 'medium'
  if (!(PRIORITY_VALUES as readonly string[]).includes(String(value))) {
    throw new ValidationError('La prioridad no es válida.')
  }
  return value as Priority
}

export function validateDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError('La fecha límite debe tener formato AAAA-MM-DD.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new ValidationError('La fecha límite no es válida.')
  }
  return value
}

export function validateLabels(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new ValidationError('Las etiquetas no son válidas.')
  const labels = uniqueIds(value.map((item) => String(item).trim().toLowerCase()))
  if (labels.length > 8) throw new ValidationError('Puedes usar como máximo 8 etiquetas.')
  for (const label of labels) {
    if (label.length > 24) throw new ValidationError('Cada etiqueta admite máximo 24 caracteres.')
  }
  return labels
}

export function nextTaskOrder(tasks: Task[], columnId: string): number {
  const columnTasks = tasks.filter((task) => task.columnId === columnId)
  if (columnTasks.length === 0) return 0
  return Math.max(...columnTasks.map((task) => task.order)) + 1
}

function sortByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export function moveTasks(
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
        completedAt = column.isDone ? (candidate.completedAt ?? now) : null
      }
      const reviewerId = isMoving && column.isDone ? null : candidate.reviewerId
      // La relación solo existe mientras la tarea está en Dependientes.
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

  // Al completar una tarea, sus dependientes salen de Dependientes cuando todas están hechas.
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
  const resolve = (taskId: string): Task | null => updated.get(taskId) ?? byId.get(taskId) ?? null
  const doneColumns = new Set(columns.filter((column) => column.isDone).map((column) => column.id))

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
  if (targetColumnId === dependentColumn.id || !columnById.has(targetColumnId)) return

  const currentOrders = tasks
    .map((candidate) => updated.get(candidate.id) ?? candidate)
    .filter((candidate) => candidate.columnId === targetColumnId)
    .map((candidate) => candidate.order)
  let nextOrder = currentOrders.length > 0 ? Math.max(...currentOrders) + 1 : 0

  for (const dependent of dependents) {
    const allDone = dependent.dependsOnTaskIds.every((taskId) => {
      const related = resolve(taskId)
      return !related || Boolean(related.completedAt) || doneColumns.has(related.columnId)
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
