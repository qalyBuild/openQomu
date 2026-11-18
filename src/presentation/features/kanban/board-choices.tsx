import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select'
import { isBoardMuted, type Board, type BoardStatus } from '@/domain/entities/kanban'

export const MUTED_BOARDS_LABEL = 'En pausa o deprecated'

export function groupBoardChoices<T>(
  items: readonly T[],
  getStatus: (item: T) => BoardStatus | undefined,
) {
  const active: T[] = []
  const muted: T[] = []
  for (const item of items) {
    const group = isBoardMuted(getStatus(item)) ? muted : active
    group.push(item)
  }
  return { active, muted }
}

export function BoardSelectOptions({ boards }: { boards: Board[] }) {
  const { active, muted } = groupBoardChoices(boards, (board) => board.status)
  const renderOption = (board: Board) => (
    <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
  )

  return (
    <>
      {active.map(renderOption)}
      {muted.length > 0 && (
        <>
          {active.length > 0 && <SelectSeparator />}
          <SelectGroup>
            <SelectLabel>{MUTED_BOARDS_LABEL}</SelectLabel>
            {muted.map(renderOption)}
          </SelectGroup>
        </>
      )}
    </>
  )
}
