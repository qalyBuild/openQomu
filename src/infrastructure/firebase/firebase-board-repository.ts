import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import type {
  BoardInput,
  BoardPatch,
  BoardRepository,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Board, BoardColumn } from '@/domain/entities/kanban'
import { DEFAULT_BOARD_COLUMNS } from '@/domain/entities/kanban'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'
import { normalizeBoardLabels } from '@/domain/services/task-service'
import { getFirebaseDb } from './client'
import { deleteCollectionDocs, nowIso } from './firestore-utils'
import { mapBoard } from './mappers'

function db() {
  return getFirebaseDb()
}

function boardsCol(workspaceId: string) {
  return collection(db(), 'workspaces', workspaceId, 'boards')
}

function boardRef(workspaceId: string, boardId: string) {
  return doc(db(), 'workspaces', workspaceId, 'boards', boardId)
}

function validateColumns(columns: BoardColumn[]): BoardColumn[] {
  if (columns.length === 0) throw new ValidationError('El tablero necesita al menos una columna.')
  const ids = new Set<string>()
  return columns.map((column) => {
    const id = column.id.trim()
    const name = column.name.trim()
    if (!id || !name) throw new ValidationError('Cada columna necesita id y nombre.')
    if (ids.has(id)) throw new ValidationError('Las columnas no pueden repetir identificador.')
    ids.add(id)
    return { id, name, color: column.color || '#94a3b8', isDone: Boolean(column.isDone) }
  })
}

export class FirebaseBoardRepository implements BoardRepository {
  async list(workspaceId: string): Promise<Board[]> {
    const snapshot = await getDocs(boardsCol(workspaceId))
    return snapshot.docs
      .map((document) => mapBoard(document.id, workspaceId, document.data()))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  subscribe(workspaceId: string, callback: Subscriber<Board[]>): Unsubscribe {
    return onSnapshot(
      boardsCol(workspaceId),
      (snapshot) => {
        callback(
          snapshot.docs
            .map((document) => mapBoard(document.id, workspaceId, document.data()))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        )
      },
      (error) => console.error('[openqomu] boards snapshot', error),
    )
  }

  async create(input: BoardInput): Promise<Board> {
    const name = input.name.trim()
    if (name.length < 2 || name.length > 60) {
      throw new ValidationError('El nombre del tablero debe tener entre 2 y 60 caracteres.')
    }
    const existing = await this.list(input.workspaceId)
    if (existing.some((board) => board.name.toLowerCase() === name.toLowerCase())) {
      throw new ConflictError(`El tablero “${name}” ya existe.`)
    }
    const now = nowIso()
    const columns = input.columns ? validateColumns(input.columns) : DEFAULT_BOARD_COLUMNS
    const reference = await addDoc(boardsCol(input.workspaceId), {
      name,
      description: input.description.trim(),
      columns,
      createdAt: now,
      createdBy: input.createdBy,
    })
    return {
      id: reference.id,
      workspaceId: input.workspaceId,
      name,
      description: input.description.trim(),
      columns,
      createdAt: now,
      createdBy: input.createdBy,
    }
  }

  async update(
    workspaceId: string,
    boardId: string,
    patch: BoardPatch,
  ): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (name.length < 2 || name.length > 60) {
        throw new ValidationError('El nombre del tablero debe tener entre 2 y 60 caracteres.')
      }
      const existing = await this.list(workspaceId)
      if (existing.some((board) => board.id !== boardId && board.name.toLowerCase() === name.toLowerCase())) {
        throw new ConflictError(`El tablero “${name}” ya existe.`)
      }
      data.name = name
    }
    if (patch.description !== undefined) data.description = patch.description.trim()
    if (patch.status !== undefined) data.status = patch.status
    if (patch.columns !== undefined) data.columns = validateColumns(patch.columns)
    if (patch.hiddenLabels !== undefined) {
      data.hiddenLabels = [...new Set(patch.hiddenLabels.map((label) => label.trim()).filter(Boolean))]
    }
    if (patch.customLabels !== undefined) {
      data.customLabels = normalizeBoardLabels(patch.customLabels)
    }
    if (Object.keys(data).length === 0) return
    await updateDoc(boardRef(workspaceId, boardId), data)
  }

  async remove(workspaceId: string, boardId: string): Promise<void> {
    const reference = boardRef(workspaceId, boardId)
    const tasks = await getDocs(collection(db(), reference.path, 'tasks'))
    for (const task of tasks.docs) {
      await deleteCollectionDocs(db(), collection(db(), task.ref.path, 'comments'))
      await deleteDoc(task.ref)
    }
    try {
      await deleteDoc(reference)
    } catch {
      throw new NotFoundError('El tablero no existe.')
    }
  }
}
