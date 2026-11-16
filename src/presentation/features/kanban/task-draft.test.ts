import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearTaskDraft,
  createEmptyTaskDraft,
  getTaskDraft,
  hasTaskDraftContent,
  saveTaskDraft,
} from './task-draft'

describe('task draft store', () => {
  beforeEach(() => {
    clearTaskDraft('board-1')
    clearTaskDraft('board-2')
  })

  it('returns null when there is no draft for the board', () => {
    expect(getTaskDraft('board-1')).toBeNull()
  })

  it('stores drafts per board and returns copies', () => {
    const draft = { ...createEmptyTaskDraft('todo', 'user-1'), title: 'Preparar release' }
    saveTaskDraft('board-1', draft)

    const restored = getTaskDraft('board-1')
    expect(restored?.title).toBe('Preparar release')

    restored!.labels.push('bug')
    expect(getTaskDraft('board-1')?.labels).toEqual([])
    expect(getTaskDraft('board-2')).toBeNull()
  })

  it('clears a draft', () => {
    saveTaskDraft('board-1', { ...createEmptyTaskDraft('todo', 'user-1'), title: 'X' })
    clearTaskDraft('board-1')
    expect(getTaskDraft('board-1')).toBeNull()
  })

  it('detects whether a draft has meaningful content', () => {
    const empty = createEmptyTaskDraft('todo', 'user-1')
    expect(hasTaskDraftContent(empty, 'user-1')).toBe(false)

    expect(hasTaskDraftContent({ ...empty, title: 'Algo' }, 'user-1')).toBe(true)
    expect(hasTaskDraftContent({ ...empty, description: 'Contexto' }, 'user-1')).toBe(true)
    expect(hasTaskDraftContent({ ...empty, priority: 'high' }, 'user-1')).toBe(true)
    expect(hasTaskDraftContent({ ...empty, dueDate: '2026-01-01' }, 'user-1')).toBe(true)
    expect(hasTaskDraftContent({ ...empty, labels: ['bug'] }, 'user-1')).toBe(true)
    expect(hasTaskDraftContent({ ...empty, attachmentIds: ['file-1'] }, 'user-1')).toBe(true)
    expect(hasTaskDraftContent({ ...empty, dependsOnTaskIds: ['task-1'] }, 'user-1')).toBe(true)
    expect(hasTaskDraftContent({ ...empty, assignees: [] }, 'user-1')).toBe(true)
  })
})
