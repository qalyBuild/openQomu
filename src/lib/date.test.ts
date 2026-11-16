import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayKey,
  daysBetween,
  formatDueDate,
  formatRelative,
  isDueSoon,
  isOverdue,
} from './date'

const NOW = new Date('2026-11-12T15:30:00.000Z')

describe('date', () => {
  it('calcula diferencias por día ignorando la hora', () => {
    expect(daysBetween('2026-11-12', NOW)).toBe(0)
    expect(daysBetween('2026-11-14', NOW)).toBe(2)
    expect(daysBetween('2026-11-10', NOW)).toBe(-2)
  })

  it('formatea fechas relativas', () => {
    expect(formatRelative(new Date(NOW.getTime() - 20_000).toISOString(), NOW)).toBe('ahora')
    expect(formatRelative(new Date(NOW.getTime() - 5 * 60_000).toISOString(), NOW)).toBe(
      'hace 5 min',
    )
    expect(formatRelative(new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), NOW)).toBe(
      'hace 3 h',
    )
    expect(formatRelative(new Date(NOW.getTime() - 26 * 3_600_000).toISOString(), NOW)).toBe(
      'ayer',
    )
  })

  it('formatea vencimientos con lenguaje natural', () => {
    expect(formatDueDate('2026-11-12', NOW)).toBe('Hoy')
    expect(formatDueDate('2026-11-13', NOW)).toBe('Mañana')
    expect(formatDueDate('2026-11-11', NOW)).toBe('Ayer')
    expect(formatDueDate(null, NOW)).toBe('Sin fecha')
  })

  it('detecta vencidas y próximas', () => {
    expect(isOverdue('2026-11-11', NOW)).toBe(true)
    expect(isOverdue('2026-11-12', NOW)).toBe(false)
    expect(isOverdue(null, NOW)).toBe(false)
    expect(isDueSoon('2026-11-14', NOW)).toBe(true)
    expect(isDueSoon('2026-12-01', NOW)).toBe(false)
  })

  it('genera claves de día y suma días', () => {
    expect(dayKey(new Date(2026, 10, 5))).toBe('2026-11-05')
    expect(dayKey(addDays('2026-11-12', 3))).toBe('2026-11-15')
  })
})
