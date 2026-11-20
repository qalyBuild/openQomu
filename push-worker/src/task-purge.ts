import type { Env } from './env'
import {
  deleteDocument,
  getDocument,
  listCollection,
  queryCollectionGroup,
  queryCollectionGroupArrayContains,
  updateDocument,
} from './firestore'
import { deleteStorageObject } from './storage'

/** Las tareas hechas se conservan quince días antes de borrarse. */
export const TASK_RETENTION_DAYS = 15
/** Tope por pasada para no agotar los subrequests del cron. */
export const TASK_PURGE_BATCH = 5
/** Tableros que el backfill revisa por ejecución. */
export const BACKFILL_BOARDS_PER_RUN = 10
export const TASK_BACKFILL_MARKER = 'maintenance/taskCompletedAtBackfill'

const DAY_MS = 24 * 60 * 60 * 1000

type StoredTask = { path: string; data: Record<string, unknown> }

export interface TaskPurgeDeps {
  listExpired(cutoff: string, limit: number): Promise<Array<StoredTask & { id: string }>>
  readTask(path: string): Promise<StoredTask | null>
  listComments(taskPath: string): Promise<Array<{ path: string }>>
  readFile(path: string): Promise<StoredTask | null>
  deleteDocument(path: string): Promise<void>
  deleteStorageObject(objectPath: string, url: string | null): Promise<void>
  listDependents(taskId: string): Promise<StoredTask[]>
  updateDocument(path: string, data: Record<string, unknown>): Promise<void>
}

export interface TaskBackfillDeps {
  getMarker(): Promise<Record<string, unknown> | null>
  saveMarker(data: Record<string, unknown>): Promise<void>
  listWorkspaces(): Promise<Array<{ path: string }>>
  listBoards(workspacePath: string): Promise<StoredTask[]>
  listTasks(boardPath: string): Promise<StoredTask[]>
  updateTask(path: string, data: Record<string, unknown>): Promise<void>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
}

/** `workspaces/{ws}/boards/{board}/tasks/{task}` → `{ws}`. */
function workspaceIdFromTaskPath(path: string): string | null {
  const segments = path.split('/')
  if (
    segments.length !== 6 ||
    segments[0] !== 'workspaces' ||
    segments[2] !== 'boards' ||
    segments[4] !== 'tasks'
  ) {
    return null
  }
  return segments[1] ?? null
}

function idFromPath(path: string): string {
  return path.split('/').pop() ?? ''
}

function doneColumnIds(columns: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(columns)) return ids
  for (const column of columns) {
    if (!column || typeof column !== 'object') continue
    const record = column as Record<string, unknown>
    const id = asString(record.id)
    if (id && record.isDone === true) ids.add(id)
  }
  return ids
}

async function purgeAttachment(
  workspaceId: string,
  fileId: string,
  deps: TaskPurgeDeps,
): Promise<void> {
  const path = `workspaces/${workspaceId}/files/${fileId}`
  const file = await deps.readFile(path)
  if (!file) return

  const rawBackend = asString(file.data.backend)
  const objectPath = asString(file.data.path)
  const url = asString(file.data.url)
  const backend =
    rawBackend === 'storage' ||
    rawBackend === 's3' ||
    rawBackend === 'local' ||
    rawBackend === 'firestore'
      ? rawBackend
      : url?.startsWith('data:') || objectPath?.startsWith('firestore://')
        ? 'firestore'
        : 'storage'

  if (backend === 'firestore') {
    await deps.deleteDocument(`${path}/data/main`)
  } else if (backend === 'storage') {
    if (objectPath) {
      try {
        await deps.deleteStorageObject(objectPath, url)
      } catch (error) {
        // El metadato se borra igualmente; un blob huérfano no debe bloquear la purga.
        console.error('[openqomu-push] no se pudo borrar el blob', objectPath, error)
      }
    }
  } else if (objectPath) {
    console.warn(
      '[openqomu-push] adjunto con backend',
      backend,
      'conserva su blob; solo se borra el metadato',
      path,
    )
  }

  await deps.deleteDocument(path)
}

/**
 * Borra las tareas completadas hace más de quince días, junto con sus
 * comentarios, adjuntos y referencias desde tareas dependientes.
 * El documento de la tarea se elimina al final para poder reintentar.
 */
export async function purgeCompletedTasks(
  env: Env,
  now: number = Date.now(),
  deps: TaskPurgeDeps = firestorePurgeDeps(env),
  limit: number = TASK_PURGE_BATCH,
): Promise<{ deleted: number; failed: number }> {
  const cutoff = new Date(now - TASK_RETENTION_DAYS * DAY_MS).toISOString()
  const expired = await deps.listExpired(cutoff, limit)
  let deleted = 0
  let failed = 0

  for (const candidate of expired) {
    try {
      // Se relee para no borrar una tarea que se reabrió tras la consulta.
      const task = await deps.readTask(candidate.path)
      if (!task) continue
      const completedAt = asString(task.data.completedAt)
      if (!completedAt || completedAt >= cutoff) continue

      const workspaceId = workspaceIdFromTaskPath(candidate.path)
      if (workspaceId) {
        for (const fileId of asStringArray(task.data.attachmentIds)) {
          await purgeAttachment(workspaceId, fileId, deps)
        }
      }

      for (const comment of await deps.listComments(candidate.path)) {
        await deps.deleteDocument(comment.path)
      }

      const taskId = idFromPath(candidate.path)
      try {
        for (const dependent of await deps.listDependents(taskId)) {
          const dependencies = asStringArray(dependent.data.dependsOnTaskIds)
          if (!dependencies.includes(taskId)) continue
          const next = dependencies.filter((id) => id !== taskId)
          await deps.updateDocument(dependent.path, {
            dependsOnTaskIds: next,
            dependsOnTaskId: next[0] ?? null,
          })
        }
      } catch (error) {
        // Una referencia colgante es tolerable: no debe impedir el borrado.
        console.error('[openqomu-push] no se pudieron limpiar dependientes', taskId, error)
      }

      await deps.deleteDocument(candidate.path)
      deleted += 1
    } catch (error) {
      failed += 1
      console.error('[openqomu-push] purga tarea', candidate.path, error)
    }
  }

  return { deleted, failed }
}

/**
 * Rellena `completedAt` con `updatedAt` en las tareas que ya estaban en una
 * columna final antes de que existiera el campo. Avanza por tableros y deja
 * un marcador para ejecutarse una sola vez.
 */
export async function backfillTaskCompletedAt(
  env: Env,
  now: number = Date.now(),
  deps: TaskBackfillDeps = firestoreBackfillDeps(env),
): Promise<{ updated: number; done: boolean }> {
  const marker = await deps.getMarker()
  if (marker?.done === true) return { updated: 0, done: true }

  const boards: StoredTask[] = []
  for (const workspace of await deps.listWorkspaces()) {
    boards.push(...(await deps.listBoards(workspace.path)))
  }
  const lastBoardPath = asString(marker?.lastBoardPath)
  const lastIndex = lastBoardPath
    ? boards.findIndex((board) => board.path === lastBoardPath)
    : -1
  if (lastBoardPath && lastIndex === -1) {
    // El tablero de progreso ya no existe: damos el backfill por terminado.
    await deps.saveMarker({ done: true, updatedAt: new Date(now).toISOString() })
    return { updated: 0, done: true }
  }
  const start = lastIndex + 1
  const batch = boards.slice(start, start + BACKFILL_BOARDS_PER_RUN)
  const fallback = new Date(now).toISOString()
  let updated = 0

  for (const board of batch) {
    const doneColumns = doneColumnIds(board.data.columns)
    if (doneColumns.size === 0) continue
    for (const task of await deps.listTasks(board.path)) {
      const columnId = asString(task.data.columnId)
      if (!columnId || !doneColumns.has(columnId) || asString(task.data.completedAt)) continue
      await deps.updateTask(task.path, {
        completedAt:
          asString(task.data.updatedAt) ?? asString(task.data.createdAt) ?? fallback,
      })
      updated += 1
    }
  }

  const last = batch.at(-1)
  const done = !last || start + batch.length >= boards.length
  await deps.saveMarker(
    done ? { done: true, updatedAt: fallback } : { done: false, lastBoardPath: last.path },
  )
  return { updated, done }
}

function firestorePurgeDeps(env: Env): TaskPurgeDeps {
  return {
    listExpired: (cutoff, limit) =>
      queryCollectionGroup(env, 'tasks', 'completedAt', 'LESS_THAN', cutoff, limit),
    readTask: async (path) => {
      const task = await getDocument(env, path)
      return task ? { path, data: task.data } : null
    },
    listComments: async (taskPath) => {
      const comments = await listCollection(env, taskPath, 'comments')
      return comments.map((comment) => ({ path: `${taskPath}/comments/${comment.id}` }))
    },
    readFile: async (path) => {
      const file = await getDocument(env, path)
      return file ? { path, data: file.data } : null
    },
    deleteDocument: (path) => deleteDocument(env, path),
    deleteStorageObject: (objectPath, url) => deleteStorageObject(env, objectPath, url),
    listDependents: (taskId) =>
      queryCollectionGroupArrayContains(env, 'tasks', 'dependsOnTaskIds', taskId, 50),
    updateDocument: async (path, data) => {
      await updateDocument(env, path, data)
    },
  }
}

function firestoreBackfillDeps(env: Env): TaskBackfillDeps {
  return {
    getMarker: async () => {
      const marker = await getDocument(env, TASK_BACKFILL_MARKER)
      return marker?.data ?? null
    },
    saveMarker: async (data) => {
      await updateDocument(env, TASK_BACKFILL_MARKER, data)
    },
    listWorkspaces: async () =>
      (await listCollection(env, '', 'workspaces')).map((workspace) => ({
        path: `workspaces/${workspace.id}`,
      })),
    listBoards: async (workspacePath) =>
      (await listCollection(env, workspacePath, 'boards')).map((board) => ({
        path: `${workspacePath}/boards/${board.id}`,
        data: board.data,
      })),
    listTasks: async (boardPath) =>
      (await listCollection(env, boardPath, 'tasks')).map((task) => ({
        path: `${boardPath}/tasks/${task.id}`,
        data: task.data,
      })),
    updateTask: async (path, data) => {
      await updateDocument(env, path, data)
    },
  }
}
