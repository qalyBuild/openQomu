import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
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
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'
import { mapBoard, mapComment, mapTask } from './mappers'

function db() {
  return getFirebaseDb()
}

function tasksCol(workspaceId: string, boardId: string) {
  return collection(db(), 'workspaces', workspaceId, 'boards', boardId, 'tasks')
}

function taskRef(workspaceId: string, boardId: string, taskId: string) {
  return doc(db(), 'workspaces', workspaceId, 'boards', boardId, 'tasks', taskId)
}

function commentsCol(workspaceId: string, boardId: string, taskId: string) {
  return collection(db(), 'workspaces', workspaceId, 'boards', boardId, 'tasks', taskId, 'comments')
}

export class FirebaseTaskRepository implements TaskRepository {
  async list(workspaceId: string, boardId: string): Promise<Task[]> {
    const snapshot = await getDocs(query(tasksCol(workspaceId, boardId), orderBy('order', 'asc')))
    return snapshot.docs.map((document) =>
      mapTask(document.id, workspaceId, boardId, document.data()),
    )
  }

  subscribe(
    workspaceId: string,
    boardId: string,
    callback: Subscriber<Task[]>,
  ): Unsubscribe {
    return onSnapshot(
      query(tasksCol(workspaceId, boardId), orderBy('order', 'asc')),
      (snapshot) => {
        callback(
          snapshot.docs.map((document) =>
            mapTask(document.id, workspaceId, boardId, document.data()),
          ),
        )
      },
      (error) => console.error('[openqomu] tasks snapshot', error),
    )
  }

  async create(input: TaskDraftInput): Promise<Task> {
    const tasks = await this.list(input.workspaceId, input.boardId)
    const reference = doc(tasksCol(input.workspaceId, input.boardId))
    const task = newTask(input, {
      id: reference.id,
      order: nextTaskOrder(tasks, input.columnId),
    })
    await setDoc(reference, {
      title: task.title,
      description: task.description,
      columnId: task.columnId,
      order: task.order,
      assigneeIds: task.assigneeIds,
      reviewerId: task.reviewerId,
      dependsOnTaskId: task.dependsOnTaskIds[0] ?? null,
      dependsOnTaskIds: task.dependsOnTaskIds,
      priority: task.priority,
      dueDate: task.dueDate,
      labels: task.labels,
      attachmentIds: task.attachmentIds,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
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
    const data: Record<string, unknown> = { updatedAt: nowIso() }
    if (patch.title !== undefined) data.title = validateTaskTitle(patch.title)
    if (patch.description !== undefined) data.description = validateDescription(patch.description)
    if (patch.priority !== undefined) data.priority = validatePriority(patch.priority)
    if (patch.dueDate !== undefined) data.dueDate = validateDueDate(patch.dueDate)
    if (patch.assigneeIds !== undefined) data.assigneeIds = uniqueIds(patch.assigneeIds)
    if (patch.reviewerId !== undefined) data.reviewerId = patch.reviewerId?.trim() || null
    if (patch.dependsOnTaskIds !== undefined) {
      const dependencies = normalizeDependencyIds(patch.dependsOnTaskIds)
      data.dependsOnTaskIds = dependencies
      data.dependsOnTaskId = dependencies[0] ?? null
    }
    if (patch.labels !== undefined) data.labels = normalizeLabels(patch.labels)
    if (patch.attachmentIds !== undefined) data.attachmentIds = uniqueIds(patch.attachmentIds)
    await updateDoc(taskRef(workspaceId, boardId, taskId), data)
  }

  async move(
    workspaceId: string,
    boardId: string,
    taskId: string,
    toColumnId: string,
    toIndex: number,
    columns: BoardColumn[],
  ): Promise<void> {
    const tasks = await this.list(workspaceId, boardId)
    const moved = moveTask(tasks, taskId, toColumnId, toIndex, columns)
    const current = new Map(tasks.map((task) => [task.id, task]))
    const changed = moved.filter((task) => current.get(task.id) !== task)
    if (changed.length === 0) return
    const batch = writeBatch(db())
    for (const task of changed) {
      batch.update(taskRef(workspaceId, boardId, task.id), {
        columnId: task.columnId,
        order: task.order,
        reviewerId: task.reviewerId,
        completedAt: task.completedAt,
        dependsOnTaskId: task.dependsOnTaskIds[0] ?? null,
        dependsOnTaskIds: task.dependsOnTaskIds,
        updatedAt: task.updatedAt,
      })
    }
    await batch.commit()
  }

  async remove(workspaceId: string, boardId: string, taskId: string): Promise<void> {
    const comments = await getDocs(commentsCol(workspaceId, boardId, taskId))
    const batch = writeBatch(db())
    for (const comment of comments.docs) batch.delete(comment.ref)
    batch.delete(taskRef(workspaceId, boardId, taskId))
    await batch.commit()
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
    const sourceTasks = await this.list(workspaceId, boardId)
    const task = sourceTasks.find((candidate) => candidate.id === taskId)
    if (!task) throw new NotFoundError('La tarea no existe.')

    const targetBoardSnapshot = await getDoc(
      doc(db(), 'workspaces', target.workspaceId, 'boards', target.boardId),
    )
    if (!targetBoardSnapshot.exists()) {
      throw new NotFoundError('El tablero de destino no existe.')
    }
    const targetBoard = mapBoard(
      targetBoardSnapshot.id,
      target.workspaceId,
      targetBoardSnapshot.data(),
    )
    const targetColumn = targetBoard.columns.find((column) => column.id === target.columnId)
    if (!targetColumn) throw new ValidationError('La columna de destino no existe.')

    const [targetTasks, membersSnapshot, comments] = await Promise.all([
      this.list(target.workspaceId, target.boardId),
      getDocs(collection(db(), 'workspaces', target.workspaceId, 'members')),
      getDocs(commentsCol(workspaceId, boardId, taskId)),
    ])
    const targetMemberIds = new Set(membersSnapshot.docs.map((member) => member.id))
    const sameWorkspace = workspaceId === target.workspaceId
    const reviewerId =
      !targetColumn.isDone && task.reviewerId && targetMemberIds.has(task.reviewerId)
        ? task.reviewerId
        : null
    const reference = doc(tasksCol(target.workspaceId, target.boardId))
    const moved = transferTask(task, {
      id: reference.id,
      workspaceId: target.workspaceId,
      boardId: target.boardId,
      columnId: target.columnId,
      order: nextTaskOrder(targetTasks, target.columnId),
      actorId,
      isDoneColumn: targetColumn.isDone,
      assigneeIds: task.assigneeIds.filter((uid) => targetMemberIds.has(uid)),
      reviewerId,
      attachmentIds: target.attachmentIds ?? (sameWorkspace ? task.attachmentIds : []),
    })

    const batch = writeBatch(db())
    batch.set(reference, {
      title: moved.title,
      description: moved.description,
      columnId: moved.columnId,
      order: moved.order,
      assigneeIds: moved.assigneeIds,
      reviewerId: moved.reviewerId,
      dependsOnTaskId: moved.dependsOnTaskIds[0] ?? null,
      dependsOnTaskIds: moved.dependsOnTaskIds,
      priority: moved.priority,
      dueDate: moved.dueDate,
      labels: moved.labels,
      attachmentIds: moved.attachmentIds,
      createdBy: moved.createdBy,
      createdAt: moved.createdAt,
      updatedAt: moved.updatedAt,
      completedAt: moved.completedAt,
    })
    for (const comment of comments.docs) {
      const data = comment.data()
      batch.set(doc(commentsCol(target.workspaceId, target.boardId, moved.id), comment.id), {
        authorId: data.authorId,
        authorName: data.authorName,
        authorPhotoURL: data.authorPhotoURL ?? null,
        body: data.body,
        createdAt: data.createdAt,
        migratedFrom: {
          workspaceId,
          boardId,
          taskId,
          commentId: comment.id,
        },
      })
      batch.delete(comment.ref)
    }
    batch.delete(taskRef(workspaceId, boardId, taskId))
    await batch.commit()

    return moved
  }

  subscribeComments(
    workspaceId: string,
    boardId: string,
    taskId: string,
    callback: Subscriber<TaskComment[]>,
  ): Unsubscribe {
    return onSnapshot(
      query(commentsCol(workspaceId, boardId, taskId), orderBy('createdAt', 'asc')),
      (snapshot) => {
        callback(
          snapshot.docs.map((document) =>
            mapComment(document.id, workspaceId, boardId, taskId, document.data()),
          ),
        )
      },
      (error) => console.error('[openqomu] comments snapshot', error),
    )
  }

  async addComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    comment: Omit<TaskComment, 'id' | 'taskId' | 'workspaceId' | 'boardId' | 'createdAt'>,
  ): Promise<TaskComment> {
    const body = comment.body.trim()
    if (!body) throw new ValidationError('El comentario no puede estar vacío.')
    const createdAt = nowIso()
    const reference = await addDoc(commentsCol(workspaceId, boardId, taskId), {
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorPhotoURL: comment.authorPhotoURL,
      body,
      createdAt,
    })
    return {
      ...comment,
      body,
      id: reference.id,
      workspaceId,
      boardId,
      taskId,
      createdAt,
    }
  }

  async removeComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
  ): Promise<void> {
    await deleteDoc(
      doc(db(), 'workspaces', workspaceId, 'boards', boardId, 'tasks', taskId, 'comments', commentId),
    )
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
    await updateDoc(
      doc(db(), 'workspaces', workspaceId, 'boards', boardId, 'tasks', taskId, 'comments', commentId),
      { body: trimmed, editedAt: nowIso() },
    )
  }
}
