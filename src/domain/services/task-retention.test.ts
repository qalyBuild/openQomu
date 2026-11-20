import { describe, expect, it } from 'vitest'
import {
  TASK_RETENTION_DAYS,
  daysUntilTaskDeletion,
  formatTaskDeletionNotice,
  taskDeletionDate,
} from './task-retention'

const NOW = new Date('2026-11-20T10:00:00.000Z')

describe('task-retention', () => {
  it('cuenta quince días desde que se completó', () => {
    const task = { completedAt: '2026-11-01T09:00:00.000Z' }
    expect(TASK_RETENTION_DAYS).toBe(15)
    expect(taskDeletionDate(task)?.toISOString()).toBe('2026-11-16T09:00:00.000Z')
  })

  it('no anuncia nada si la tarea no está completada', () => {
    expect(taskDeletionDate({ completedAt: null })).toBeNull()
    expect(daysUntilTaskDeletion({ completedAt: null }, NOW)).toBeNull()
    expect(formatTaskDeletionNotice({ completedAt: null }, NOW)).toBeNull()
  })

  it('calcula los días restantes sin bajar de cero', () => {
    expect(daysUntilTaskDeletion({ completedAt: '2026-11-19T10:00:00.000Z' }, NOW)).toBe(14)
    expect(daysUntilTaskDeletion({ completedAt: '2026-11-01T10:00:00.000Z' }, NOW)).toBe(0)
  })

  it('redacta el aviso con fecha y días restantes', () => {
    expect(formatTaskDeletionNotice({ completedAt: '2026-11-19T10:00:00.000Z' }, NOW)).toBe(
      'Se elimina el 4 de diciembre de 2026 · quedan 14 días',
    )
  })

  it('usa un texto propio para mañana y para hoy', () => {
    expect(formatTaskDeletionNotice({ completedAt: '2026-11-06T10:00:00.000Z' }, NOW)).toBe(
      'Se elimina mañana (21 de noviembre de 2026)',
    )
    expect(formatTaskDeletionNotice({ completedAt: '2026-11-05T10:00:00.000Z' }, NOW)).toBe(
      'Se elimina hoy',
    )
  })
})
