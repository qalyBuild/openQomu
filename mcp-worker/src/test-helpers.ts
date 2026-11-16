import type { BoardColumn, Task } from './domain'

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'dependents', name: 'Dependientes', color: '#ef4444', isDone: false },
  { id: 'todo', name: 'Por hacer', color: '#94a3b8', isDone: false },
  { id: 'doing', name: 'En curso', color: '#8b5cf6', isDone: false },
  { id: 'review', name: 'En revisión', color: '#f59e0b', isDone: false },
  { id: 'done', name: 'Hecho', color: '#10b981', isDone: true },
]

export function makeTask(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    workspaceId: 'ws',
    boardId: 'board',
    title: `Tarea ${overrides.id}`,
    description: '',
    columnId: 'todo',
    order: 0,
    assigneeIds: [],
    reviewerId: null,
    dependsOnTaskIds: [],
    priority: 'medium',
    dueDate: null,
    labels: [],
    attachmentIds: [],
    createdBy: 'u1',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    completedAt: null,
    ...overrides,
  }
}
