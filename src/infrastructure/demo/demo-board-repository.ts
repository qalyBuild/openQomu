import type {
  BoardInput,
  BoardRepository,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Board, BoardColumn } from '@/domain/entities/kanban'
import { DEFAULT_BOARD_COLUMNS } from '@/domain/entities/kanban'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'
import { normalizeBoardLabels } from '@/domain/services/task-service'
import type { DemoStore } from './store'
import { createId } from './store'
import { getWorkspace, listBoards } from './selectors'

function validateColumns(columns: BoardColumn[]): BoardColumn[] {
  if (columns.length === 0) throw new ValidationError('El tablero necesita al menos una columna.')
  const ids = new Set<string>()
  return columns.map((column) => {
    const id = column.id.trim()
    const name = column.name.trim()
    if (!id || !name) throw new ValidationError('Cada columna necesita id y nombre.')
    if (ids.has(id)) throw new ValidationError('Las columnas no pueden repetir identificador.')
    ids.add(id)
    return {
      id,
      name,
      color: column.color || '#94a3b8',
      isDone: Boolean(column.isDone),
    }
  })
}

export class DemoBoardRepository implements BoardRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async list(workspaceId: string): Promise<Board[]> {
    return listBoards(this.store.getState(), workspaceId)
  }

  subscribe(workspaceId: string, callback: Subscriber<Board[]>): Unsubscribe {
    const emit = () => callback(listBoards(this.store.getState(), workspaceId))
    emit()
    return this.store.subscribe(emit)
  }

  async create(input: BoardInput): Promise<Board> {
    if (!getWorkspace(this.store.getState(), input.workspaceId)) {
      throw new NotFoundError('El espacio de trabajo no existe.')
    }
    const name = input.name.trim()
    if (name.length < 2 || name.length > 60) {
      throw new ValidationError('El nombre del tablero debe tener entre 2 y 60 caracteres.')
    }
    const duplicated = listBoards(this.store.getState(), input.workspaceId).some(
      (board) => board.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicated) throw new ConflictError(`El tablero “${name}” ya existe.`)

    const board: Board = {
      id: createId('board'),
      workspaceId: input.workspaceId,
      name,
      description: input.description.trim(),
      columns: input.columns ? validateColumns(input.columns) : DEFAULT_BOARD_COLUMNS,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }
    this.store.commit((draft) => {
      draft.boards[board.id] = board
    })
    return board
  }

  async update(
    workspaceId: string,
    boardId: string,
    patch: Partial<Pick<Board, 'name' | 'description' | 'columns' | 'hiddenLabels' | 'customLabels'>>,
  ): Promise<void> {
    const board = this.store.getState().boards[boardId]
    if (!board || board.workspaceId !== workspaceId) {
      throw new NotFoundError('El tablero no existe.')
    }
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (name.length < 2 || name.length > 60) {
        throw new ValidationError('El nombre del tablero debe tener entre 2 y 60 caracteres.')
      }
    }
    this.store.commit((draft) => {
      const target = draft.boards[boardId]
      if (!target) return
      if (patch.name !== undefined) target.name = patch.name.trim()
      if (patch.description !== undefined) target.description = patch.description.trim()
      if (patch.columns !== undefined) target.columns = validateColumns(patch.columns)
      if (patch.hiddenLabels !== undefined) {
        target.hiddenLabels = [...new Set(patch.hiddenLabels.map((label) => label.trim()).filter(Boolean))]
      }
      if (patch.customLabels !== undefined) {
        target.customLabels = normalizeBoardLabels(patch.customLabels)
      }
    })
  }

  async remove(workspaceId: string, boardId: string): Promise<void> {
    const board = this.store.getState().boards[boardId]
    if (!board || board.workspaceId !== workspaceId) {
      throw new NotFoundError('El tablero no existe.')
    }
    this.store.commit((draft) => {
      delete draft.boards[boardId]
      const taskIds = new Set<string>()
      for (const [id, task] of Object.entries(draft.tasks)) {
        if (task.boardId === boardId) {
          taskIds.add(id)
          delete draft.tasks[id]
        }
      }
      for (const [id, comment] of Object.entries(draft.comments)) {
        if (comment.boardId === boardId && taskIds.has(comment.taskId)) {
          delete draft.comments[id]
        }
      }
    })
  }
}
