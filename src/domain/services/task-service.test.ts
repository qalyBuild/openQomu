import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD_COLUMNS, defaultTaskColumnId, type Task } from '@/domain/entities/kanban'
import {
  collectTaskLabels,
  filterTasks,
  moveTask,
  newTask,
  nextTaskOrder,
  normalizeBoardLabels,
  normalizeLabels,
  sortBoardTasks,
  summarizeBoard,
  tasksDueSoon,
  transferTask,
  validateDueDate,
  validateTaskDependencies,
  validateTaskTitle,
} from './task-service'

const NOW = '2026-11-12T10:00:00.000Z'
const COLUMNS = DEFAULT_BOARD_COLUMNS

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
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    ...overrides,
  }
}

describe('task-service', () => {
  it('crea tareas normalizando el texto y sin duplicados', () => {
    const created = newTask(
      {
        workspaceId: 'ws',
        boardId: 'board',
        title: '  Diseñar landing  ',
        description: '  Hero + CTA  ',
        columnId: 'todo',
        priority: 'high',
        dueDate: '2026-11-20',
        assigneeIds: ['u1', 'u1', 'u2'],
        dependsOnTaskIds: ['  t0  ', 't0'],
        labels: [' Diseño ', 'diseño', 'frontend'],
        createdBy: 'u1',
      },
      { id: 't1', order: 3, now: NOW },
    )
    expect(created.title).toBe('Diseñar landing')
    expect(created.description).toBe('Hero + CTA')
    expect(created.assigneeIds).toEqual(['u1', 'u2'])
    expect(created.dependsOnTaskIds).toEqual(['t0'])
    expect(created.labels).toEqual(['diseño', 'frontend'])
    expect(created.order).toBe(3)
    expect(created.createdAt).toBe(NOW)
    expect(created.completedAt).toBeNull()
  })

  it('elige una columna por defecto que no sea Dependientes', () => {
    expect(defaultTaskColumnId(DEFAULT_BOARD_COLUMNS)).toBe('todo')
    expect(
      defaultTaskColumnId([
        { id: 'dependents', name: 'Dependientes', color: '#f59e0b', isDone: false },
        { id: 'qa', name: 'QA', color: '#ffffff', isDone: false },
      ]),
    ).toBe('qa')
  })

  it('ordena las tareas de cada columna por prioridad de mayor a menor', () => {
    const tasks = [
      task({ id: 'low', columnId: 'todo', order: 0, priority: 'low' }),
      task({ id: 'urgent', columnId: 'todo', order: 1, priority: 'urgent' }),
      task({ id: 'medium', columnId: 'todo', order: 2, priority: 'medium' }),
      task({ id: 'high-a', columnId: 'todo', order: 3, priority: 'high' }),
      task({ id: 'high-b', columnId: 'todo', order: 4, priority: 'high' }),
    ]

    const grouped = sortBoardTasks(tasks, COLUMNS)
    expect(grouped.todo.map((candidate) => candidate.id)).toEqual([
      'urgent',
      'high-a',
      'high-b',
      'medium',
      'low',
    ])
  })

  it('mueve una tarea dependiente a Por hacer cuando su única relacionada se completa', () => {
    const related = task({ id: 'rel', columnId: 'doing', order: 0 })
    const dependent = task({
      id: 'dep',
      columnId: 'dependents',
      order: 0,
      dependsOnTaskIds: ['rel'],
    })
    const pending = task({ id: 'pending', columnId: 'todo', order: 0 })

    const moved = moveTask([related, dependent, pending], 'rel', 'done', 0, COLUMNS, NOW)
    const released = moved.find((candidate) => candidate.id === 'dep')

    expect(released?.columnId).toBe('todo')
    expect(released?.order).toBe(1)
    expect(released?.completedAt).toBeNull()
    expect(released?.dependsOnTaskIds).toEqual([])
    expect(released?.updatedAt).toBe(NOW)
  })

  it('solo libera una tarea cuando todas sus relacionadas están hechas', () => {
    const first = task({ id: 'rel-a', columnId: 'doing', order: 0 })
    const second = task({ id: 'rel-b', columnId: 'todo', order: 0 })
    const dependent = task({
      id: 'dep',
      columnId: 'dependents',
      order: 0,
      dependsOnTaskIds: ['rel-a', 'rel-b'],
    })

    const afterFirst = moveTask([first, second, dependent], 'rel-a', 'done', 0, COLUMNS, NOW)
    expect(afterFirst.find((candidate) => candidate.id === 'dep')?.columnId).toBe('dependents')
    expect(afterFirst.find((candidate) => candidate.id === 'dep')?.dependsOnTaskIds).toEqual([
      'rel-a',
      'rel-b',
    ])

    const afterSecond = moveTask(afterFirst, 'rel-b', 'done', 0, COLUMNS, NOW)
    const released = afterSecond.find((candidate) => candidate.id === 'dep')
    expect(released?.columnId).toBe('todo')
    expect(released?.dependsOnTaskIds).toEqual([])
  })

  it('no permite relacionar una tarea completada', () => {    const done = task({ id: 'done', columnId: 'done', completedAt: NOW })
    const open = task({ id: 'open', columnId: 'todo' })

    expect(() => validateTaskDependencies(['done'], [done, open], COLUMNS)).toThrow(
      'completada',
    )
    expect(validateTaskDependencies(['open'], [done, open], COLUMNS)).toEqual(['open'])
  })

  it('elimina la relación cuando la tarea sale de Dependientes', () => {
    const dependent = task({
      id: 'dep',
      columnId: 'dependents',
      order: 0,
      dependsOnTaskIds: ['rel'],
    })

    const moved = moveTask([dependent], 'dep', 'doing', 0, COLUMNS, NOW)
    expect(moved.find((candidate) => candidate.id === 'dep')?.dependsOnTaskIds).toEqual([])
  })

  it('mantiene la relación mientras la tarea sigue en Dependientes', () => {
    const first = task({ id: 'a', columnId: 'dependents', order: 0, dependsOnTaskIds: ['rel'] })
    const second = task({ id: 'b', columnId: 'dependents', order: 1 })

    const moved = moveTask([first, second], 'a', 'dependents', 1, COLUMNS, NOW)
    expect(moved.find((candidate) => candidate.id === 'a')?.dependsOnTaskIds).toEqual(['rel'])
  })

  it('no mueve tareas dependientes que no están en Dependientes', () => {
    const related = task({ id: 'rel', columnId: 'doing' })
    const dependent = task({
      id: 'dep',
      columnId: 'todo',
      order: 1,
      dependsOnTaskIds: ['rel'],
    })

    const moved = moveTask([related, dependent], 'rel', 'done', 0, COLUMNS, NOW)
    expect(moved.find((candidate) => candidate.id === 'dep')?.columnId).toBe('todo')
  })

  it('limpia la dependencia al migrar una tarea de tablero', () => {
    const original = task({ id: 'a', dependsOnTaskIds: ['b'] })
    const moved = transferTask(original, {
      id: 'c',
      workspaceId: 'ws-2',
      boardId: 'board-2',
      columnId: 'todo',
      order: 0,
      actorId: 'u2',
      now: NOW,
    })
    expect(moved.dependsOnTaskIds).toEqual([])
  })

  it('normaliza las etiquetas personalizadas del tablero', () => {
    expect(normalizeBoardLabels([' Dashboard/QA ', 'dashboard/qa', '', 'QA'])).toEqual([
      'dashboard/qa',
      'qa',
    ])
    expect(() => normalizeBoardLabels(['x'.repeat(25)])).toThrow('24')
    expect(() => normalizeBoardLabels(Array.from({ length: 51 }, (_, index) => `l${index}`))).toThrow(
      '50',
    )
  })

  it('valida entradas de tarea', () => {
    expect(() => validateTaskTitle('   ')).toThrow('obligatorio')
    expect(() => validateTaskTitle('x'.repeat(161))).toThrow('160')
    expect(() => validateDueDate('2026-02-30')).toThrow('no es una fecha válida')
    expect(() => validateDueDate('12/11/2026')).toThrow('AAAA-MM-DD')
    expect(validateDueDate(null)).toBeNull()
    expect(() => normalizeLabels(Array.from({ length: 9 }, (_, index) => `l${index}`))).toThrow('8')
    expect(() =>
      newTask(
        { workspaceId: 'ws', boardId: 'b', title: 'T', columnId: 'todo', createdBy: 'u', priority: 'nope' as never },
        { id: 't' },
      ),
    ).toThrow('prioridad')
  })

  it('reordena dentro de la misma columna', () => {
    const tasks = [task({ id: 'a', order: 0 }), task({ id: 'b', order: 1 }), task({ id: 'c', order: 2 })]
    const moved = moveTask(tasks, 'a', 'todo', 2, COLUMNS, NOW)
    expect(moved.find((t) => t.id === 'a')?.order).toBe(2)
    expect(moved.find((t) => t.id === 'b')?.order).toBe(0)
    expect(moved.find((t) => t.id === 'c')?.order).toBe(1)
    expect(moved.find((t) => t.id === 'a')?.completedAt).toBeNull()
  })

  it('mueve entre columnas y marca/limpia la finalización', () => {
    const tasks = [
      task({ id: 'a', order: 0, reviewerId: 'u2' }),
      task({ id: 'b', order: 1 }),
      task({ id: 'done-1', columnId: 'done', order: 0, completedAt: '2026-11-01T09:00:00.000Z' }),
    ]
    const toDone = moveTask(tasks, 'a', 'done', 0, COLUMNS, NOW)
    const movedA = toDone.find((t) => t.id === 'a')!
    expect(movedA.columnId).toBe('done')
    expect(movedA.completedAt).toBe(NOW)
    expect(movedA.reviewerId).toBeNull()
    expect(toDone.find((t) => t.id === 'done-1')?.order).toBe(1)
    expect(toDone.find((t) => t.id === 'b')?.order).toBe(0)

    const back = moveTask(toDone, 'a', 'todo', 1, COLUMNS, '2026-11-13T10:00:00.000Z')
    expect(back.find((t) => t.id === 'a')?.completedAt).toBeNull()
    expect(back.find((t) => t.id === 'a')?.reviewerId).toBeNull()
    expect(back.find((t) => t.id === 'a')?.columnId).toBe('todo')
  })

  it('conserva completedAt al reordenar dentro de la columna hecha', () => {
    const completedAt = '2026-11-01T09:00:00.000Z'
    const tasks = [
      task({ id: 'a', columnId: 'done', order: 0, completedAt }),
      task({ id: 'b', columnId: 'done', order: 1, completedAt }),
    ]
    const moved = moveTask(tasks, 'a', 'done', 1, COLUMNS, NOW)
    expect(moved.find((t) => t.id === 'a')?.completedAt).toBe(completedAt)
  })

  it('limita el índice y falla con ids desconocidos', () => {
    const tasks = [task({ id: 'a' })]
    expect(moveTask(tasks, 'a', 'todo', 99, COLUMNS, NOW)[0].order).toBe(0)
    expect(() => moveTask(tasks, 'nope', 'todo', 0, COLUMNS, NOW)).toThrow('no existe')
    expect(() => moveTask(tasks, 'a', 'nope', 0, COLUMNS, NOW)).toThrow('columna')
  })

  it('calcula el siguiente orden', () => {
    const tasks = [task({ id: 'a', order: 0 }), task({ id: 'b', order: 4 })]
    expect(nextTaskOrder(tasks, 'todo')).toBe(5)
    expect(nextTaskOrder(tasks, 'doing')).toBe(0)
  })

  it('resume el tablero', () => {
    const tasks = [
      task({ id: 'a', columnId: 'todo', dueDate: '2026-11-10' }),
      task({ id: 'b', columnId: 'done', completedAt: NOW }),
      task({ id: 'c', columnId: 'doing', dueDate: '2026-11-20' }),
      task({ id: 'd', columnId: 'done', completedAt: NOW }),
      task({ id: 'paused', columnId: 'todo', priority: 'paused', dueDate: '2026-11-09' }),
    ]
    const summary = summarizeBoard(tasks, COLUMNS, new Date('2026-11-12T12:00:00.000Z'))
    expect(summary.total).toBe(5)
    expect(summary.completed).toBe(2)
    expect(summary.open).toBe(2)
    expect(summary.overdue).toBe(1)
    expect(summary.completionRate).toBe(40)
    expect(summary.byColumn).toEqual({ dependents: 0, todo: 2, doing: 1, review: 0, done: 2 })
  })

  it('filtra por texto, persona, prioridad y etiqueta', () => {
    const tasks = [
      task({ id: 'a', title: 'Landing', assigneeIds: ['u1'], priority: 'high', labels: ['frontend'] }),
      task({ id: 'b', title: 'API', assigneeIds: ['u2'], priority: 'low', labels: ['dashboard/qa'] }),
    ]
    expect(filterTasks(tasks, { query: 'land' }).map((t) => t.id)).toEqual(['a'])
    expect(filterTasks(tasks, { query: 'frontend' }).map((t) => t.id)).toEqual(['a'])
    expect(filterTasks(tasks, { assigneeId: 'u2' }).map((t) => t.id)).toEqual(['b'])
    expect(filterTasks(tasks, { priority: 'high' }).map((t) => t.id)).toEqual(['a'])
    expect(filterTasks(tasks, { label: 'dashboard/qa' }).map((t) => t.id)).toEqual(['b'])
    expect(filterTasks(tasks, { label: 'backend' })).toEqual([])
    expect(filterTasks(tasks, { onlyMine: 'u1' }).map((t) => t.id)).toEqual(['a'])
  })

  it('recoge las etiquetas usadas para sugerirlas', () => {
    const tasks = [
      task({ id: 'a', labels: ['diseño', 'dashboard/qa'] }),
      task({ id: 'b', labels: ['diseño', 'equipo'] }),
    ]
    expect(collectTaskLabels(tasks).sort()).toEqual(['dashboard/qa', 'diseño', 'equipo'])
  })

  it('lista vencimientos próximos sin completadas', () => {
    const tasks = [
      task({ id: 'a', dueDate: '2026-11-13' }),
      task({ id: 'b', dueDate: '2026-11-10' }),
      task({ id: 'c', dueDate: '2026-11-14', columnId: 'done', completedAt: NOW }),
      task({ id: 'd', dueDate: '2026-12-01' }),
    ]
    const soon = tasksDueSoon(tasks, COLUMNS, new Date('2026-11-12T12:00:00.000Z'))
    expect(soon.map((t) => t.id)).toEqual(['a'])
  })
})
