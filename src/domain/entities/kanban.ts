import type { Priority } from './identity'

export interface BoardColumn {
  id: string
  name: string
  color: string
  isDone: boolean
}

export function isReviewColumn(column: Pick<BoardColumn, 'id' | 'name'>): boolean {
  return column.id === 'review' || /revis|review/i.test(column.name)
}

export const DEPENDENTS_COLUMN_ID = 'dependents'

export function isDependentsColumn(column: Pick<BoardColumn, 'id' | 'name'>): boolean {
  return column.id === DEPENDENTS_COLUMN_ID || /dependiente/i.test(column.name)
}

/** Columna por defecto para una tarea nueva: evita Dependientes y prefiere "Por hacer". */
export function defaultTaskColumnId(columns: BoardColumn[]): string {
  return (
    columns.find((column) => column.id === 'todo') ??
    columns.find((column) => !isDependentsColumn(column)) ??
    columns[0]
  )?.id ?? 'todo'
}

export function mergeBoardColumns(boards: Pick<Board, 'columns'>[]): BoardColumn[] {
  const merged = new Map<string, BoardColumn>()
  for (const board of boards) {
    for (const column of board.columns) {
      if (!merged.has(column.id)) merged.set(column.id, column)
    }
  }
  return [...merged.values()]
}

export const BOARD_STATUSES = ['normal', 'paused', 'deprecated'] as const
export type BoardStatus = (typeof BOARD_STATUSES)[number]

export function isBoardStatus(value: unknown): value is BoardStatus {
  return BOARD_STATUSES.some((status) => status === value)
}

export function isBoardMuted(status: unknown): boolean {
  return status === 'paused' || status === 'deprecated'
}

export interface Board {
  id: string
  workspaceId: string
  name: string
  description: string
  status?: BoardStatus
  columns: BoardColumn[]
  /** Etiquetas predeterminadas que el equipo decidió ocultar. */
  hiddenLabels?: string[]
  /** Etiquetas personalizadas del tablero; persisten aunque ninguna tarea las use. */
  customLabels?: string[]
  createdAt: string
  createdBy: string
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
  /** Tareas de las que depende. Solo tiene sentido en la columna Dependientes. */
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
  /** Momento de la última edición, si la tuvo. */
  editedAt?: string | null
}

export interface TaskDraftInput {
  workspaceId: string
  boardId: string
  title: string
  description?: string
  columnId: string
  priority?: Priority
  dueDate?: string | null
  assigneeIds?: string[]
  reviewerId?: string | null
  dependsOnTaskIds?: string[]
  labels?: string[]
  attachmentIds?: string[]
  createdBy: string
}

export interface BoardSummary {
  total: number
  completed: number
  open: number
  overdue: number
  byColumn: Record<string, number>
  completionRate: number
}

export const DEFAULT_BOARD_COLUMNS: BoardColumn[] = [
  { id: DEPENDENTS_COLUMN_ID, name: 'Dependientes', color: '#ef4444', isDone: false },
  { id: 'todo', name: 'Por hacer', color: '#94a3b8', isDone: false },
  { id: 'doing', name: 'En curso/rechazadas', color: '#8b5cf6', isDone: false },
  { id: 'review', name: 'En revisión', color: '#f59e0b', isDone: false },
  { id: 'done', name: 'Hecho', color: '#10b981', isDone: true },
]

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
