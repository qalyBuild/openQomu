import type {
  Subscriber,
  TaskRepository,
  Unsubscribe,
} from '@/domain/ports'
import type { BoardColumn, Task, TaskComment, TaskDraftInput } from '@/domain/entities/kanban'
import { NotFoundError, ValidationError } from '@/domain/errors'
import {
  moveTask,
  newTask,
  nextTaskOrder,
  normalizeDependencyIds,
  normalizeLabels,
  transferTask,
  uniqueIds,
  validateDescription,
  validateDueDate,
  validatePriority,
  validateTaskTitle,
} from '@/domain/services/task-service'
import type { DemoStore } from './store'
import { createId } from './store'
import { listComments, listMembers, listTasks } from './selectors'

export class DemoTaskRepository implements TaskRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async list(workspaceId: string, boardId: string): Promise<Task[]> {
    return listTasks(this.store.getState(), workspaceId, boardId)
  }

  subscribe(
    workspaceId: string,
    boardId: string,
    callback: Subscriber<Task[]>,
  ): Unsubscribe {
    const emit = () => callback(listTasks(this.store.getState(), workspaceId, boardId))
    emit()
    return this.store.subscribe(emit)
  }

  async create(input: TaskDraftInput): Promise<Task> {
    const state = this.store.getState()
    const board = state.boards[input.boardId]
    if (!board || board.workspaceId !== input.workspaceId) {
      throw new NotFoundError('El tablero no existe.')
    }
    if (!board.columns.some((column) => column.id === input.columnId)) {
      throw new ValidationError('La columna de destino no existe.')
    }
    const tasks = listTasks(state, input.workspaceId, input.boardId)
    const task = newTask(input, {
      id: createId('task'),
      order: nextTaskOrder(tasks, input.columnId),
    })
    this.store.commit((draft) => {
      draft.tasks[task.id] = task
    })
    return task
  }

  async update(
    workspaceId: string,
    boardId: string,
    taskId: string,
    patch: Partial<
      Pick<
        Task,
        | 'title'
        | 'description'
        | 'priority'
        | 'dueDate'
        | 'assigneeIds'
        | 'reviewerId'
        | 'dependsOnTaskIds'
        | 'labels'
        | 'attachmentIds'
      >
    >,
  ): Promise<void> {
    this.requireTask(workspaceId, boardId, taskId)
    this.store.commit((draft) => {
      const task = draft.tasks[taskId]
      if (!task) return
      if (patch.title !== undefined) task.title = validateTaskTitle(patch.title)
      if (patch.description !== undefined) task.description = validateDescription(patch.description)
      if (patch.priority !== undefined) task.priority = validatePriority(patch.priority)
      if (patch.dueDate !== undefined) task.dueDate = validateDueDate(patch.dueDate)
      if (patch.assigneeIds !== undefined) task.assigneeIds = uniqueIds(patch.assigneeIds)
      if (patch.reviewerId !== undefined) task.reviewerId = patch.reviewerId?.trim() || null
      if (patch.dependsOnTaskIds !== undefined) {
        task.dependsOnTaskIds = normalizeDependencyIds(patch.dependsOnTaskIds)
      }
      if (patch.labels !== undefined) task.labels = normalizeLabels(patch.labels)
      if (patch.attachmentIds !== undefined) {
        task.attachmentIds = uniqueIds(patch.attachmentIds)
      }
      task.updatedAt = new Date().toISOString()
    })
  }

  async move(
    workspaceId: string,
    boardId: string,
    taskId: string,
    toColumnId: string,
    toIndex: number,
    columns: BoardColumn[],
  ): Promise<void> {
    const board = this.store.getState().boards[boardId]
    if (!board || board.workspaceId !== workspaceId) {
      throw new NotFoundError('El tablero no existe.')
    }
    const tasks = listTasks(this.store.getState(), workspaceId, boardId)
    const moved = moveTask(tasks, taskId, toColumnId, toIndex, columns)
    const currentById = new Map(tasks.map((task) => [task.id, task]))
    const changed = moved.filter((task) => currentById.get(task.id) !== task)
    if (changed.length === 0) return
    this.store.commit((draft) => {
      for (const task of changed) draft.tasks[task.id] = task
    })
  }

  async remove(workspaceId: string, boardId: string, taskId: string): Promise<void> {
    this.requireTask(workspaceId, boardId, taskId)
    this.store.commit((draft) => {
      delete draft.tasks[taskId]
      for (const [id, comment] of Object.entries(draft.comments)) {
        if (comment.taskId === taskId) delete draft.comments[id]
      }
    })
  }

  async transfer(
    workspaceId: string,
    boardId: string,
    taskId: string,
    target: {
      workspaceId: string
      boardId: string
      columnId: string
      attachmentIds?: string[]
    },
    actorId: string,
  ): Promise<Task> {
    const task = this.requireTask(workspaceId, boardId, taskId)
    const state = this.store.getState()
    const targetBoard = state.boards[target.boardId]
    if (!targetBoard || targetBoard.workspaceId !== target.workspaceId) {
      throw new NotFoundError('El tablero de destino no existe.')
    }
    const targetColumn = targetBoard.columns.find((column) => column.id === target.columnId)
    if (!targetColumn) throw new ValidationError('La columna de destino no existe.')

    const targetTasks = listTasks(state, target.workspaceId, target.boardId)
    const sameWorkspace = workspaceId === target.workspaceId
    const targetMemberIds = new Set(
      listMembers(state, target.workspaceId).map((member) => member.uid),
    )
    const moved = transferTask(task, {
      id: taskId,
      workspaceId: target.workspaceId,
      boardId: target.boardId,
      columnId: target.columnId,
      order: nextTaskOrder(targetTasks, target.columnId),
      actorId,
      isDoneColumn: targetColumn.isDone,
      assigneeIds: task.assigneeIds.filter((uid) => targetMemberIds.has(uid)),
      reviewerId:
        !targetColumn.isDone && task.reviewerId && targetMemberIds.has(task.reviewerId)
          ? task.reviewerId
          : null,
      attachmentIds: target.attachmentIds ?? (sameWorkspace ? task.attachmentIds : []),
    })

    this.store.commit((draft) => {
      draft.tasks[taskId] = moved
      for (const comment of Object.values(draft.comments)) {
        if (comment.taskId !== taskId) continue
        comment.workspaceId = target.workspaceId
        comment.boardId = target.boardId
      }
    })
    return moved
  }

  subscribeComments(
    workspaceId: string,
    boardId: string,
    taskId: string,
    callback: Subscriber<TaskComment[]>,
  ): Unsubscribe {
    const emit = () =>
      callback(listComments(this.store.getState(), workspaceId, boardId, taskId))
    emit()
    return this.store.subscribe(emit)
  }

  async addComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    comment: Omit<TaskComment, 'id' | 'taskId' | 'workspaceId' | 'boardId' | 'createdAt'>,
  ): Promise<TaskComment> {
    this.requireTask(workspaceId, boardId, taskId)
    const body = comment.body.trim()
    if (!body) throw new ValidationError('El comentario no puede estar vacío.')
    if (body.length > 2000) throw new ValidationError('El comentario es demasiado largo.')
    const created: TaskComment = {
      ...comment,
      body,
      id: createId('comment'),
      workspaceId,
      boardId,
      taskId,
      createdAt: new Date().toISOString(),
    }
    this.store.commit((draft) => {
      draft.comments[created.id] = created
    })
    return created
  }

  async removeComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
  ): Promise<void> {
    const comment = this.store.getState().comments[commentId]
    if (
      !comment ||
      comment.workspaceId !== workspaceId ||
      comment.boardId !== boardId ||
      comment.taskId !== taskId
    ) {
      throw new NotFoundError('El comentario no existe.')
    }
    this.store.commit((draft) => {
      delete draft.comments[commentId]
    })
  }

  async updateComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
    body: string,
  ): Promise<void> {
    const trimmed = body.trim()
    if (!trimmed) throw new ValidationError('El comentario no puede estar vacío.')
    if (trimmed.length > 2000) throw new ValidationError('El comentario es demasiado largo.')
    const comment = this.store.getState().comments[commentId]
    if (
      !comment ||
      comment.workspaceId !== workspaceId ||
      comment.boardId !== boardId ||
      comment.taskId !== taskId
    ) {
      throw new NotFoundError('El comentario no existe.')
    }
    this.store.commit((draft) => {
      const target = draft.comments[commentId]
      if (!target) return
      target.body = trimmed
      target.editedAt = new Date().toISOString()
    })
  }

  private requireTask(workspaceId: string, boardId: string, taskId: string): Task {
    const task = this.store.getState().tasks[taskId]
    if (!task || task.workspaceId !== workspaceId || task.boardId !== boardId) {
      throw new NotFoundError('La tarea no existe.')
    }
    return task
  }
}
