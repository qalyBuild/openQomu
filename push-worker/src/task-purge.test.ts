import { describe, expect, it } from 'vitest'
import type { Env } from './env'
import {
  TASK_RETENTION_DAYS,
  backfillTaskCompletedAt,
  purgeCompletedTasks,
  type TaskBackfillDeps,
  type TaskPurgeDeps,
} from './task-purge'

const env = { FIREBASE_PROJECT_ID: 'qomu-app', FIREBASE_SERVICE_ACCOUNT: '{}' } satisfies Env
const NOW = Date.parse('2026-11-20T12:00:00.000Z')
const TASK_PATH = 'workspaces/w1/boards/b1/tasks/t1'

function baseDeps(overrides: Partial<TaskPurgeDeps> = {}): TaskPurgeDeps {
  return {
    listExpired: async () => [],
    readTask: async () => null,
    listComments: async () => [],
    readFile: async () => null,
    deleteDocument: async () => {},
    deleteStorageObject: async () => {},
    listDependents: async () => [],
    updateDocument: async () => {},
    ...overrides,
  }
}

describe('purgeCompletedTasks', () => {
  it('usa un corte de quince días y borra comentarios, adjuntos y referencias', async () => {
    let cutoff = ''
    const deleted: string[] = []
    const updated: Array<[string, Record<string, unknown>]> = []
    const task = {
      path: TASK_PATH,
      data: {
        completedAt: '2026-11-01T09:00:00.000Z',
        attachmentIds: ['f1'],
      },
    }
    const deps = baseDeps({
      listExpired: async (value) => {
        cutoff = value
        return [{ id: 't1', ...task }]
      },
      readTask: async () => task,
      readFile: async (path) => ({
        path,
        data: { backend: 'firestore', path: 'firestore://f1' },
      }),
      listComments: async () => [
        { path: `${TASK_PATH}/comments/c1` },
        { path: `${TASK_PATH}/comments/c2` },
      ],
      listDependents: async () => [
        {
          path: 'workspaces/w1/boards/b1/tasks/t2',
          data: { dependsOnTaskIds: ['t1', 't9'] },
        },
      ],
      deleteDocument: async (path) => {
        deleted.push(path)
      },
      updateDocument: async (path, data) => {
        updated.push([path, data])
      },
    })

    const result = await purgeCompletedTasks(env, NOW, deps)

    expect(cutoff).toBe(
      new Date(NOW - TASK_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    )
    expect(result).toEqual({ deleted: 1, failed: 0 })
    expect(deleted).toEqual([
      'workspaces/w1/files/f1/data/main',
      'workspaces/w1/files/f1',
      `${TASK_PATH}/comments/c1`,
      `${TASK_PATH}/comments/c2`,
      TASK_PATH,
    ])
    expect(updated).toEqual([
      [
        'workspaces/w1/boards/b1/tasks/t2',
        { dependsOnTaskIds: ['t9'], dependsOnTaskId: 't9' },
      ],
    ])
  })

  it('no borra una tarea que se reabrió después de la consulta', async () => {
    const deleted: string[] = []
    let dependentQueries = 0
    const deps = baseDeps({
      listExpired: async () => [
        { id: 't1', path: TASK_PATH, data: { completedAt: '2026-11-01T09:00:00.000Z' } },
      ],
      readTask: async () => ({ path: TASK_PATH, data: { completedAt: null } }),
      listDependents: async () => {
        dependentQueries += 1
        return []
      },
      deleteDocument: async (path) => {
        deleted.push(path)
      },
    })

    const result = await purgeCompletedTasks(env, NOW, deps)

    expect(result).toEqual({ deleted: 0, failed: 0 })
    expect(deleted).toEqual([])
    expect(dependentQueries).toBe(0)
  })

  it('borra el blob en Storage y solo el metadato en S3', async () => {
    const blobs: Array<[string, string | null]> = []
    const deleted: string[] = []
    const tasks = [
      {
        id: 't1',
        path: 'workspaces/w1/boards/b1/tasks/t1',
        data: { completedAt: '2026-11-01T09:00:00.000Z', attachmentIds: ['f1'] },
      },
      {
        id: 't2',
        path: 'workspaces/w1/boards/b1/tasks/t2',
        data: { completedAt: '2026-11-01T09:00:00.000Z', attachmentIds: ['f2'] },
      },
    ]
    const files: Record<string, Record<string, unknown>> = {
      'workspaces/w1/files/f1': {
        backend: 'storage',
        path: 'workspaces/w1/f1-foto.png',
        url: 'https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/foto.png',
      },
      'workspaces/w1/files/f2': { backend: 's3', path: 's3://w1/f2' },
    }
    const deps = baseDeps({
      listExpired: async () => tasks,
      readTask: async (path) => tasks.find((task) => task.path === path) ?? null,
      readFile: async (path) => {
        const data = files[path]
        return data ? { path, data } : null
      },
      deleteStorageObject: async (objectPath, url) => {
        blobs.push([objectPath, url])
      },
      deleteDocument: async (path) => {
        deleted.push(path)
      },
    })

    const result = await purgeCompletedTasks(env, NOW, deps)

    expect(result).toEqual({ deleted: 2, failed: 0 })
    expect(blobs).toEqual([
      [
        'workspaces/w1/f1-foto.png',
        'https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/foto.png',
      ],
    ])
    expect(deleted).toEqual([
      'workspaces/w1/files/f1',
      'workspaces/w1/boards/b1/tasks/t1',
      'workspaces/w1/files/f2',
      'workspaces/w1/boards/b1/tasks/t2',
    ])
  })

  it('borra la tarea aunque falle la limpieza de dependientes', async () => {
    const deleted: string[] = []
    const deps = baseDeps({
      listExpired: async () => [
        { id: 't1', path: TASK_PATH, data: { completedAt: '2026-11-01T09:00:00.000Z' } },
      ],
      readTask: async () => ({
        path: TASK_PATH,
        data: { completedAt: '2026-11-01T09:00:00.000Z' },
      }),
      listDependents: async () => {
        throw new Error('index missing')
      },
      deleteDocument: async (path) => {
        deleted.push(path)
      },
    })

    const result = await purgeCompletedTasks(env, NOW, deps)

    expect(result).toEqual({ deleted: 1, failed: 0 })
    expect(deleted).toEqual([TASK_PATH])
  })

  it('cuenta el fallo de una tarea y sigue con las demás', async () => {    const deleted: string[] = []
    const deps = baseDeps({
      listExpired: async () => [
        { id: 't1', path: TASK_PATH, data: { completedAt: '2026-11-01T09:00:00.000Z' } },
        {
          id: 't2',
          path: 'workspaces/w1/boards/b1/tasks/t2',
          data: { completedAt: '2026-11-01T09:00:00.000Z' },
        },
      ],
      readTask: async (path) => {
        if (path === TASK_PATH) throw new Error('boom')
        return { path, data: { completedAt: '2026-11-01T09:00:00.000Z' } }
      },
      deleteDocument: async (path) => {
        deleted.push(path)
      },
    })

    const result = await purgeCompletedTasks(env, NOW, deps)

    expect(result).toEqual({ deleted: 1, failed: 1 })
    expect(deleted).toEqual(['workspaces/w1/boards/b1/tasks/t2'])
  })
})

describe('backfillTaskCompletedAt', () => {
  const boardPath = 'workspaces/w1/boards/b1'

  function backfillDeps(overrides: Partial<TaskBackfillDeps> = {}): TaskBackfillDeps {
    return {
      getMarker: async () => null,
      saveMarker: async () => {},
      listWorkspaces: async () => [{ path: 'workspaces/w1' }],
      listBoards: async () => [
        {
          path: boardPath,
          data: {
            columns: [
              { id: 'todo', isDone: false },
              { id: 'done', isDone: true },
            ],
          },
        },
      ],
      listTasks: async () => [],
      updateTask: async () => {},
      ...overrides,
    }
  }

  it('no hace nada si el marcador ya está completado', async () => {
    let listed = false
    const result = await backfillTaskCompletedAt(
      env,
      NOW,
      backfillDeps({
        getMarker: async () => ({ done: true }),
        listWorkspaces: async () => {
          listed = true
          return []
        },
      }),
    )
    expect(result).toEqual({ updated: 0, done: true })
    expect(listed).toBe(false)
  })

  it('rellena completedAt solo en columnas finales sin fecha', async () => {
    const updated: Array<[string, Record<string, unknown>]> = []
    let marker: Record<string, unknown> | null = null
    const result = await backfillTaskCompletedAt(
      env,
      NOW,
      backfillDeps({
        listTasks: async () => [
          {
            path: `${boardPath}/tasks/t1`,
            data: { columnId: 'done', updatedAt: '2026-10-01T08:00:00.000Z' },
          },
          {
            path: `${boardPath}/tasks/t2`,
            data: {
              columnId: 'done',
              completedAt: '2026-10-02T08:00:00.000Z',
              updatedAt: '2026-10-02T08:00:00.000Z',
            },
          },
          {
            path: `${boardPath}/tasks/t3`,
            data: { columnId: 'todo', updatedAt: '2026-10-03T08:00:00.000Z' },
          },
        ],
        updateTask: async (path, data) => {
          updated.push([path, data])
        },
        saveMarker: async (data) => {
          marker = data
        },
      }),
    )

    expect(result).toEqual({ updated: 1, done: true })
    expect(updated).toEqual([
      [`${boardPath}/tasks/t1`, { completedAt: '2026-10-01T08:00:00.000Z' }],
    ])
    expect(marker).toEqual({ done: true, updatedAt: new Date(NOW).toISOString() })
  })

  it('guarda el último tablero cuando quedan más para la siguiente pasada', async () => {
    const boards = Array.from({ length: 12 }, (_, index) => ({
      path: `workspaces/w1/boards/b${index}`,
      data: { columns: [{ id: 'done', isDone: true }] },
    }))
    let marker: Record<string, unknown> | null = null
    const result = await backfillTaskCompletedAt(
      env,
      NOW,
      backfillDeps({
        listBoards: async () => boards,
        saveMarker: async (data) => {
          marker = data
        },
      }),
    )

    expect(result).toEqual({ updated: 0, done: false })
    expect(marker).toEqual({ done: false, lastBoardPath: 'workspaces/w1/boards/b9' })
  })
})
