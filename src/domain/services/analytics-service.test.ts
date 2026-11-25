import { describe, expect, it } from 'vitest'
import type { Member } from '@/domain/entities/identity'
import { DEFAULT_BOARD_COLUMNS, mergeBoardColumns, type Board, type Task } from '@/domain/entities/kanban'
import { buildCompletionTrend, buildDashboard, dashboardTasks } from './analytics-service'

const NOW = new Date('2026-11-12T12:00:00.000Z')

function task(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
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

function member(uid: string, name: string): Member {
  return {
    id: uid,
    workspaceId: 'ws',
    uid,
    role: 'member',
    displayName: name,
    email: `${uid}@example.com`,
    photoURL: null,
    joinedAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: null,
  }
}

const tasks = [
  task({ id: 'a', assigneeIds: ['u1'], priority: 'high', dueDate: '2026-11-14' }),
  task({ id: 'b', columnId: 'done', assigneeIds: ['u1'], completedAt: '2026-11-12T09:00:00.000Z' }),
  task({ id: 'c', columnId: 'review', assigneeIds: ['u2'], priority: 'urgent', dueDate: '2026-11-10' }),
  task({ id: 'd', columnId: 'doing', assigneeIds: ['u2'], createdAt: '2026-11-12T08:00:00.000Z' }),
]

describe('analytics-service', () => {
  it('excluye las tareas pendientes de tableros inactivos y conserva las completadas', () => {
    const boards = [
      { id: 'normal', status: 'normal', columns: DEFAULT_BOARD_COLUMNS },
      { id: 'paused', status: 'paused', columns: DEFAULT_BOARD_COLUMNS },
      { id: 'deprecated', status: 'deprecated', columns: DEFAULT_BOARD_COLUMNS },
    ] as Board[]
    const result = dashboardTasks([
      task({ id: 'active', boardId: 'normal' }),
      task({ id: 'paused', boardId: 'paused' }),
      task({ id: 'deprecated', boardId: 'deprecated' }),
      task({ id: 'finished', boardId: 'paused', columnId: 'done' }),
    ], boards)
    expect(result.map(({ id }) => id)).toEqual(['active', 'finished'])
    expect(buildDashboard(result, DEFAULT_BOARD_COLUMNS, [], NOW).open).toBe(1)
  })
  it('calcula métricas del dashboard', () => {
    const metrics = buildDashboard(tasks, DEFAULT_BOARD_COLUMNS, [member('u1', 'Ana'), member('u2', 'Bruno')], NOW)
    expect(metrics.total).toBe(4)
    expect(metrics.completed).toBe(1)
    expect(metrics.open).toBe(3)
    expect(metrics.overdue).toBe(1)
    expect(metrics.waitingReview).toBe(1)
    expect(metrics.urgentOpen).toBe(1)
    expect(metrics.completionRate).toBe(25)
    expect(metrics.byStatus.map((s) => s.count)).toEqual([0, 1, 1, 1, 1])
    expect(metrics.byStatus.map((s) => s.label)).toEqual([
      'Dependientes',
      'Por hacer',
      'En curso/rechazadas',
      'En revisión',
      'Hecho',
    ])
    expect(metrics.byPriority.find((p) => p.priority === 'urgent')?.count).toBe(1)
    expect(metrics.dueSoon.map((t) => t.id)).toEqual(['a'])
  })

  it('calcula la carga por persona', () => {
    const metrics = buildDashboard(tasks, DEFAULT_BOARD_COLUMNS, [member('u1', 'Ana'), member('u2', 'Bruno')], NOW)
    const ana = metrics.workload.find((w) => w.uid === 'u1')!
    const bruno = metrics.workload.find((w) => w.uid === 'u2')!
    expect(ana.total).toBe(2)
    expect(ana.completed).toBe(1)
    expect(ana.open).toBe(1)
    expect(bruno.total).toBe(2)
    expect(bruno.open).toBe(2)
    expect(metrics.workload[0].uid).toBe('u2')
  })

  it('excluye las tareas en pausa de las abiertas y de los avisos', () => {
    const pausedTasks = [
      ...tasks,
      task({
        id: 'paused',
        columnId: 'doing',
        assigneeIds: ['u2'],
        priority: 'paused',
        dueDate: '2026-11-11',
      }),
    ]
    const metrics = buildDashboard(
      pausedTasks,
      DEFAULT_BOARD_COLUMNS,
      [member('u1', 'Ana'), member('u2', 'Bruno')],
      NOW,
    )
    expect(metrics.total).toBe(5)
    expect(metrics.open).toBe(3)
    expect(metrics.overdue).toBe(1)
    expect(metrics.dueSoon.map((t) => t.id)).toEqual(['a'])
    expect(metrics.byPriority.find((p) => p.priority === 'paused')?.count).toBe(1)
    expect(metrics.workload.find((w) => w.uid === 'u2')?.open).toBe(2)
  })

  it('combina las columnas de todos los tableros', () => {
    const merged = mergeBoardColumns([
      { columns: DEFAULT_BOARD_COLUMNS },
      {
        columns: [
          ...DEFAULT_BOARD_COLUMNS,
          { id: 'qa', name: 'QA', color: '#ffffff', isDone: false },
        ],
      },
    ])
    expect(merged.map((column) => column.id)).toEqual([
      'dependents',
      'todo',
      'doing',
      'review',
      'done',
      'qa',
    ])
  })

  it('genera una tendencia de 14 días con datos del día', () => {
    const trend = buildCompletionTrend(tasks, NOW, 14)
    expect(trend).toHaveLength(14)
    expect(trend[13].date).toBe('2026-11-12')
    expect(trend[13].created).toBe(1)
    expect(trend[13].completed).toBe(1)
    expect(trend.every((point) => point.label.length > 0)).toBe(true)
  })

  it('maneja un tablero vacío', () => {
    const metrics = buildDashboard([], DEFAULT_BOARD_COLUMNS, [], NOW)
    expect(metrics.total).toBe(0)
    expect(metrics.waitingReview).toBe(0)
    expect(metrics.urgentOpen).toBe(0)
    expect(metrics.completionRate).toBe(0)
    expect(metrics.byStatus).toHaveLength(5)
    expect(metrics.byPriority).toHaveLength(5)
    expect(metrics.workload).toEqual([])
    expect(metrics.dueSoon).toEqual([])
    expect(metrics.trend).toHaveLength(14)
  })
})
