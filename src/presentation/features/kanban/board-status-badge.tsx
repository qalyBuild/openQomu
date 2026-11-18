import { Badge } from '@/components/ui/badge'
import type { BoardStatus } from '@/domain/entities/kanban'

export const BOARD_STATUS_LABELS: Record<BoardStatus, string> = {
  normal: 'Normal',
  paused: 'En pausa',
  deprecated: 'Deprecated',
}

export function BoardStatusBadge({ status }: { status: BoardStatus | undefined }) {
  if (status !== 'paused' && status !== 'deprecated') return null
  return (
    <Badge variant={status === 'paused' ? 'secondary' : 'outline'}>
      {BOARD_STATUS_LABELS[status]}
    </Badge>
  )
}
