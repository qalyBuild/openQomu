import { expect, it } from 'vitest'
import type { BoardStatus } from '@/domain/entities/kanban'
import { groupBoardChoices } from './board-choices'

it('keeps active and legacy boards first, preserving the order within each group', () => {
  const statuses: (BoardStatus | undefined)[] = ['deprecated', undefined, 'paused', 'normal']
  expect(groupBoardChoices(statuses, (status) => status)).toEqual({
    active: [undefined, 'normal'],
    muted: ['deprecated', 'paused'],
  })
})
