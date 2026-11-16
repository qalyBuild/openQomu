import { describe, expect, it } from 'vitest'
import { moveTasks, validateDependencies } from './domain'
import { DEFAULT_COLUMNS, makeTask } from './test-helpers'

describe('moveTasks', () => {
  it('mueve entre columnas y limpia el reviewer al entrar en hecho', () => {
    const tasks = [
      makeTask({ id: 'a', columnId: 'todo', order: 0, reviewerId: 'u2' }),
      makeTask({ id: 'b', columnId: 'todo', order: 1 }),
    ]
    const moved = moveTasks(tasks, 'a', 'done', 0, DEFAULT_COLUMNS, '2026-11-12T10:00:00.000Z')
    const task = moved.find((candidate) => candidate.id === 'a')!
    expect(task.columnId).toBe('done')
    expect(task.reviewerId).toBeNull()
    expect(task.completedAt).toBe('2026-11-12T10:00:00.000Z')
    expect(moved.find((candidate) => candidate.id === 'b')?.order).toBe(0)
  })

  it('no restaura el reviewer al volver a una columna abierta', () => {
    const tasks = [makeTask({ id: 'a', columnId: 'done', order: 0, reviewerId: null })]
    const moved = moveTasks(tasks, 'a', 'todo', 0, DEFAULT_COLUMNS, '2026-11-12T10:00:00.000Z')
    expect(moved[0].reviewerId).toBeNull()
    expect(moved[0].completedAt).toBeNull()
  })

  it('rechaza columnas desconocidas', () => {
    const tasks = [makeTask({ id: 'a' })]
    expect(() => moveTasks(tasks, 'a', 'nope', 0, DEFAULT_COLUMNS)).toThrow('columna')
  })

  it('libera la tarea dependiente cuando todas sus relacionadas están hechas', () => {
    const tasks = [
      makeTask({ id: 'rel-a', columnId: 'doing', order: 0 }),
      makeTask({ id: 'rel-b', columnId: 'doing', order: 1 }),
      makeTask({ id: 'dep', columnId: 'dependents', order: 0, dependsOnTaskIds: ['rel-a', 'rel-b'] }),
    ]

    const afterFirst = moveTasks(tasks, 'rel-a', 'done', 0, DEFAULT_COLUMNS, '2026-11-12T10:00:00.000Z')
    expect(afterFirst.find((task) => task.id === 'dep')?.columnId).toBe('dependents')

    const afterSecond = moveTasks(
      afterFirst,
      'rel-b',
      'done',
      0,
      DEFAULT_COLUMNS,
      '2026-11-12T10:05:00.000Z',
    )
    const released = afterSecond.find((task) => task.id === 'dep')!
    expect(released.columnId).toBe('todo')
    expect(released.dependsOnTaskIds).toEqual([])
  })

  it('limpia la relación al salir de Dependientes', () => {
    const tasks = [makeTask({ id: 'dep', columnId: 'dependents', dependsOnTaskIds: ['rel'] })]
    const moved = moveTasks(tasks, 'dep', 'doing', 0, DEFAULT_COLUMNS)
    expect(moved[0].dependsOnTaskIds).toEqual([])
  })

  it('no permite relacionar tareas completadas', () => {
    const done = makeTask({ id: 'done', columnId: 'done', completedAt: '2026-11-12T10:00:00.000Z' })
    const open = makeTask({ id: 'open', columnId: 'todo' })

    expect(() => validateDependencies(['done'], [done, open], DEFAULT_COLUMNS)).toThrow('completada')
    expect(validateDependencies(['open'], [done, open], DEFAULT_COLUMNS)).toEqual(['open'])
  })
})
