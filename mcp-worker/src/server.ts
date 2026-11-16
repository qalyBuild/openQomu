import { env as workerEnv } from 'cloudflare:workers'
import { McpServer } from '@modelcontextprotocol/server'
import { getMcpAuthContext } from 'agents/mcp/server'
import { z } from 'zod'
import { auditWrite } from './audit'
import type { AuthProps } from './auth'
import {
  assertWriteScope,
  commentPath,
  listBoards,
  listMembers,
  listTasks,
  listWorkspacesForUser,
  requireBoard,
  requireMembership,
  requireTask,
  requireWorkspace,
  taskPath,
} from './data'
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  mapComment,
  nextTaskOrder,
  moveTasks,
  uniqueIds,
  validateDescription,
  validateDependencies,
  validateDueDate,
  validateLabels,
  validatePriority,
  validateTitle,
  type Board,
  type Member,
  type Task,
  type TaskComment,
} from './domain'
import type { Env } from './env'
import {
  commitWrites,
  createDocument,
  listCollection,
  updateDocument,
} from './firestore'

const env = workerEnv as unknown as Env

const INSTRUCTIONS = `openQomu es un espacio de trabajo con espacios, tableros, tareas, comentarios y miembros.
- Un espacio (workspace) contiene tableros (boards).
- Cada tablero tiene columnas; la columna con isDone=true representa "hecho".
- Las tareas tienen assigneeIds (responsables) y reviewerId (responsable de revisión).
- Al mover una tarea a una columna isDone, reviewerId se borra.
- Nunca inventes IDs. Resuelve primero espacios, tableros y tareas.
- No borres ni transfieras datos sin confirmación explícita del usuario.
- Si una herramienta devuelve un error de permisos, explícalo y no intentes saltarlo.`

function auth(): AuthProps {
  const props = getMcpAuthContext()?.props as AuthProps | undefined
  if (!props) throw new Error('No autenticado.')
  return props
}

function ok(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

function fail(error: unknown) {
  const message =
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ValidationError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Error inesperado.'
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  }
}

async function withErrors<T extends Record<string, unknown>>(
  callback: () => Promise<T>,
): Promise<ReturnType<typeof ok> | ReturnType<typeof fail>> {
  try {
    return ok(await callback())
  } catch (error) {
    return fail(error)
  }
}

function taskSummary(task: Task) {
  return {
    id: task.id,
    title: task.title,
    columnId: task.columnId,
    priority: task.priority,
    dueDate: task.dueDate,
    assigneeIds: task.assigneeIds,
    reviewerId: task.reviewerId,
    labels: task.labels,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt,
  }
}

function taskFields(task: Task) {
  return {
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
  }
}

async function validatePeople(
  workspaceId: string,
  assigneeIds: string[] | undefined,
  reviewerId: string | null | undefined,
): Promise<{ assigneeIds?: string[]; reviewerId?: string | null }> {
  if (assigneeIds === undefined && reviewerId === undefined) return {}
  const members = await listMembers(env, workspaceId)
  const byUid = new Map(members.map((member) => [member.uid, member]))
  const result: { assigneeIds?: string[]; reviewerId?: string | null } = {}
  if (assigneeIds !== undefined) {
    const ids = uniqueIds(assigneeIds)
    const unknown = ids.find((uid) => !byUid.has(uid))
    if (unknown) throw new ValidationError(`El responsable ${unknown} no pertenece al espacio.`)
    result.assigneeIds = ids
  }
  if (reviewerId !== undefined) {
    if (reviewerId !== null && !byUid.has(reviewerId)) {
      throw new ValidationError('El responsable de revisión no pertenece al espacio.')
    }
    result.reviewerId = reviewerId
  }
  return result
}

function taskIsDone(task: Task, board: Board): boolean {
  return Boolean(task.completedAt) || Boolean(board.columns.find((column) => column.id === task.columnId)?.isDone)
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'openqomu', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  )

  server.registerTool(
    'list_workspaces',
    {
      title: 'Listar espacios',
      description: 'Devuelve los espacios de openQomu a los que pertenece el usuario del token.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const current = auth()
      return withErrors(async () => ({
        items: (await listWorkspacesForUser(env, current.uid)).map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          icon: workspace.icon,
          description: workspace.description,
          ownerId: workspace.ownerId,
        })),
      }))
    },
  )

  server.registerTool(
    'get_workspace',
    {
      title: 'Obtener espacio',
      description: 'Devuelve los datos básicos de un espacio y el rol del usuario.',
      inputSchema: z.object({ workspaceId: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId }) => {
      const current = auth()
      return withErrors(async () => {
        const membership = await requireMembership(env, workspaceId, current.uid)
        const workspace = await requireWorkspace(env, workspaceId)
        return {
          workspace: {
            id: workspace.id,
            name: workspace.name,
            icon: workspace.icon,
            description: workspace.description,
            ownerId: workspace.ownerId,
          },
          role: membership.role,
        }
      })
    },
  )

  server.registerTool(
    'list_boards',
    {
      title: 'Listar tableros',
      description: 'Lista los tableros de un espacio con sus columnas.',
      inputSchema: z.object({ workspaceId: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId }) => {
      const current = auth()
      return withErrors(async () => {
        await requireMembership(env, workspaceId, current.uid)
        return {
          items: (await listBoards(env, workspaceId)).map((board) => ({
            id: board.id,
            name: board.name,
            description: board.description,
            columns: board.columns,
          })),
        }
      })
    },
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'Listar tareas',
      description:
        'Lista tareas de un tablero. Permite filtrar por columna, responsable, reviewer o texto.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        columnId: z.string().optional(),
        assigneeId: z.string().optional(),
        reviewerId: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId, boardId, columnId, assigneeId, reviewerId, query, limit }) => {
      const current = auth()
      return withErrors(async () => {
        await requireMembership(env, workspaceId, current.uid)
        await requireBoard(env, workspaceId, boardId)
        const normalizedQuery = query?.trim().toLowerCase()
        const tasks = (await listTasks(env, workspaceId, boardId)).filter((task) => {
          if (columnId && task.columnId !== columnId) return false
          if (assigneeId && !task.assigneeIds.includes(assigneeId)) return false
          if (reviewerId && task.reviewerId !== reviewerId) return false
          if (normalizedQuery) {
            const haystack = `${task.title} ${task.description} ${task.labels.join(' ')}`.toLowerCase()
            if (!haystack.includes(normalizedQuery)) return false
          }
          return true
        })
        const limited = tasks.slice(0, limit ?? 50)
        return {
          total: tasks.length,
          items: limited.map(taskSummary),
        }
      })
    },
  )

  server.registerTool(
    'get_task',
    {
      title: 'Obtener tarea',
      description: 'Devuelve una tarea completa, incluyendo descripción y adjuntos.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        taskId: z.string().min(1),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId, boardId, taskId }) => {
      const current = auth()
      return withErrors(async () => {
        await requireMembership(env, workspaceId, current.uid)
        await requireBoard(env, workspaceId, boardId)
        const task = await requireTask(env, workspaceId, boardId, taskId)
        return { task: { ...task } }
      })
    },
  )

  server.registerTool(
    'search_tasks',
    {
      title: 'Buscar tareas',
      description: 'Busca tareas por texto en todos los tableros de un espacio.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId, query, limit }) => {
      const current = auth()
      return withErrors(async () => {
        await requireMembership(env, workspaceId, current.uid)
        const normalized = query.trim().toLowerCase()
        const boards = await listBoards(env, workspaceId)
        const matches: Array<{ board: string; task: ReturnType<typeof taskSummary> }> = []
        for (const board of boards) {
          const tasks = await listTasks(env, workspaceId, board.id)
          for (const task of tasks) {
            const haystack = `${task.title} ${task.description} ${task.labels.join(' ')}`.toLowerCase()
            if (!haystack.includes(normalized)) continue
            matches.push({ board: board.name, task: taskSummary(task) })
            if (matches.length >= (limit ?? 20)) break
          }
          if (matches.length >= (limit ?? 20)) break
        }
        return { items: matches }
      })
    },
  )

  server.registerTool(
    'list_members',
    {
      title: 'Listar miembros',
      description: 'Lista los miembros de un espacio y sus roles.',
      inputSchema: z.object({ workspaceId: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId }) => {
      const current = auth()
      return withErrors(async () => {
        await requireMembership(env, workspaceId, current.uid)
        return {
          items: (await listMembers(env, workspaceId)).map((member: Member) => ({
            uid: member.uid,
            displayName: member.displayName,
            photoURL: member.photoURL,
            role: member.role,
          })),
        }
      })
    },
  )

  server.registerTool(
    'list_comments',
    {
      title: 'Listar comentarios',
      description: 'Lista los comentarios de una tarea en orden cronológico.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        taskId: z.string().min(1),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId, boardId, taskId }) => {
      const current = auth()
      return withErrors(async () => {
        await requireMembership(env, workspaceId, current.uid)
        await requireTask(env, workspaceId, boardId, taskId)
        const documents = await listCollection<Record<string, unknown>>(
          env,
          taskPath(workspaceId, boardId, taskId),
          'comments',
        )
        const comments = documents
          .map((document) =>
            mapComment(document.id, workspaceId, boardId, taskId, document.data),
          )
          .sort((a: TaskComment, b: TaskComment) => a.createdAt.localeCompare(b.createdAt))
        return { items: comments }
      })
    },
  )

  server.registerTool(
    'create_task',
    {
      title: 'Crear tarea',
      description:
        'Crea una tarea en un tablero. Si no se indica columna, usa la primera del tablero. `dependsOnTaskIds` relaciona varias tareas abiertas; la tarea se moverá a Por hacer cuando todas estén hechas.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        title: z.string().min(1).max(160),
        description: z.string().max(4000).optional(),
        columnId: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent', 'paused']).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        assigneeIds: z.array(z.string()).optional(),
        reviewerId: z.string().nullable().optional(),
        dependsOnTaskIds: z.array(z.string()).max(10).optional(),
        labels: z.array(z.string()).optional(),
      }),
    },
    async ({
      workspaceId,
      boardId,
      title,
      description,
      columnId,
      priority,
      dueDate,
      assigneeIds,
      reviewerId,
      dependsOnTaskIds: dependencyInput,
      labels,
    }) => {
      const current = auth()
      return withErrors(async () => {
        assertWriteScope(current)
        await requireMembership(env, workspaceId, current.uid)
        const board = await requireBoard(env, workspaceId, boardId)
        const targetColumnId = columnId ?? board.columns[0]?.id
        const column = board.columns.find((item) => item.id === targetColumnId)
        if (!column) throw new ValidationError('La columna no existe.')
        const people = await validatePeople(workspaceId, assigneeIds, reviewerId)
        const tasks = await listTasks(env, workspaceId, boardId)
        const dependencies = validateDependencies(dependencyInput, tasks, board.columns)
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        const task: Task = {
          id,
          workspaceId,
          boardId,
          title: validateTitle(title),
          description: validateDescription(description),
          columnId: column.id,
          order: nextTaskOrder(tasks, column.id),
          assigneeIds: people.assigneeIds ?? [],
          reviewerId: column.isDone ? null : (people.reviewerId ?? null),
          dependsOnTaskIds: dependencies,
          priority: validatePriority(priority),
          dueDate: validateDueDate(dueDate),
          labels: validateLabels(labels),
          attachmentIds: [],
          createdBy: current.uid,
          createdAt: now,
          updatedAt: now,
          completedAt: column.isDone ? now : null,
        }
        await createDocument(
          env,
          `workspaces/${workspaceId}/boards/${boardId}`,
          'tasks',
          id,
          taskFields(task),
        )
        await auditWrite(env, current, 'create_task', workspaceId, {
          boardId,
          taskId: id,
          title: task.title,
          columnId: task.columnId,
        })
        return { task: { ...task } }
      })
    },
  )

  server.registerTool(
    'update_task',
    {
      title: 'Actualizar tarea',
      description:
        'Actualiza título, descripción, prioridad, fecha, responsables, reviewer, etiquetas o dependencias (`dependsOnTaskIds`, solo tareas abiertas).',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        taskId: z.string().min(1),
        title: z.string().min(1).max(160).optional(),
        description: z.string().max(4000).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent', 'paused']).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        assigneeIds: z.array(z.string()).optional(),
        reviewerId: z.string().nullable().optional(),
        dependsOnTaskIds: z.array(z.string()).max(10).optional(),
        labels: z.array(z.string()).optional(),
      }),
    },
    async ({ workspaceId, boardId, taskId, ...patch }) => {
      const current = auth()
      return withErrors(async () => {
        assertWriteScope(current)
        await requireMembership(env, workspaceId, current.uid)
        const board = await requireBoard(env, workspaceId, boardId)
        const task = await requireTask(env, workspaceId, boardId, taskId)
        const tasks = await listTasks(env, workspaceId, boardId)
        const people = await validatePeople(workspaceId, patch.assigneeIds, patch.reviewerId)
        const dependsOnTaskIds =
          patch.dependsOnTaskIds === undefined
            ? task.dependsOnTaskIds
            : validateDependencies(patch.dependsOnTaskIds, tasks, board.columns, taskId)
        const updated: Task = {
          ...task,
          title: patch.title === undefined ? task.title : validateTitle(patch.title),
          description:
            patch.description === undefined
              ? task.description
              : validateDescription(patch.description),
          priority:
            patch.priority === undefined ? task.priority : validatePriority(patch.priority),
          dueDate:
            patch.dueDate === undefined ? task.dueDate : validateDueDate(patch.dueDate),
          assigneeIds: people.assigneeIds ?? task.assigneeIds,
          reviewerId: people.reviewerId !== undefined ? people.reviewerId : task.reviewerId,
          dependsOnTaskIds,
          labels: patch.labels === undefined ? task.labels : validateLabels(patch.labels),
          updatedAt: new Date().toISOString(),
        }
        if (taskIsDone(updated, board)) updated.reviewerId = null
        await updateDocument(
          env,
          taskPath(workspaceId, boardId, taskId),
          taskFields(updated),
        )
        await auditWrite(env, current, 'update_task', workspaceId, {
          boardId,
          taskId,
          fields: Object.keys(patch),
        })
        return { task: { ...updated } }
      })
    },
  )

  server.registerTool(
    'assign_reviewer',
    {
      title: 'Asignar responsable de revisión',
      description:
        'Asigna o quita el responsable de revisión. En tareas completadas no se permite asignarlo.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        taskId: z.string().min(1),
        reviewerId: z.string().nullable(),
      }),
    },
    async ({ workspaceId, boardId, taskId, reviewerId }) => {
      const current = auth()
      return withErrors(async () => {
        assertWriteScope(current)
        await requireMembership(env, workspaceId, current.uid)
        const board = await requireBoard(env, workspaceId, boardId)
        const task = await requireTask(env, workspaceId, boardId, taskId)
        if (reviewerId !== null && taskIsDone(task, board)) {
          throw new ValidationError('La tarea ya está completada; no admite reviewer.')
        }
        const people = await validatePeople(workspaceId, undefined, reviewerId)
        const updated = {
          ...task,
          reviewerId: people.reviewerId ?? null,
          updatedAt: new Date().toISOString(),
        }
        await updateDocument(env, taskPath(workspaceId, boardId, taskId), {
          reviewerId: updated.reviewerId,
          updatedAt: updated.updatedAt,
        })
        await auditWrite(env, current, 'assign_reviewer', workspaceId, {
          boardId,
          taskId,
          reviewerId: updated.reviewerId,
        })
        return { task: { ...updated } }
      })
    },
  )

  server.registerTool(
    'move_task',
    {
      title: 'Mover tarea',
      description:
        'Mueve una tarea a una columna. Si la columna es isDone, se limpia el reviewer. El índice es opcional.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        taskId: z.string().min(1),
        columnId: z.string().min(1),
        index: z.number().int().min(0).optional(),
      }),
    },
    async ({ workspaceId, boardId, taskId, columnId, index }) => {
      const current = auth()
      return withErrors(async () => {
        assertWriteScope(current)
        await requireMembership(env, workspaceId, current.uid)
        const board = await requireBoard(env, workspaceId, boardId)
        const tasks = await listTasks(env, workspaceId, boardId)
        const task = tasks.find((candidate) => candidate.id === taskId)
        if (!task) throw new NotFoundError('La tarea no existe.')
        const targetColumn = board.columns.find((column) => column.id === columnId)
        if (!targetColumn) throw new ValidationError('La columna no existe.')
        const targetCount = tasks.filter((item) => item.columnId === columnId && item.id !== taskId).length
        const targetIndex = index ?? targetCount
        const moved = moveTasks(tasks, taskId, columnId, targetIndex, board.columns)
        const changed = moved.filter((candidate) => {
          const previous = tasks.find((item) => item.id === candidate.id)
          return !previous || JSON.stringify(previous) !== JSON.stringify(candidate)
        })
        await commitWrites(
          env,
          changed.map((candidate) => ({
            path: taskPath(workspaceId, boardId, candidate.id),
            data: {
              columnId: candidate.columnId,
              order: candidate.order,
              reviewerId: candidate.reviewerId,
              completedAt: candidate.completedAt,
              dependsOnTaskId: candidate.dependsOnTaskIds[0] ?? null,
              dependsOnTaskIds: candidate.dependsOnTaskIds,
              updatedAt: candidate.updatedAt,
            },
            fieldPaths: [
              'columnId',
              'order',
              'reviewerId',
              'completedAt',
              'dependsOnTaskId',
              'dependsOnTaskIds',
              'updatedAt',
            ],
          })),
        )
        const result = moved.find((candidate) => candidate.id === taskId) ?? task
        await auditWrite(env, current, 'move_task', workspaceId, {
          boardId,
          taskId,
          from: task.columnId,
          to: columnId,
        })
        return { task: { ...result } }
      })
    },
  )

  server.registerTool(
    'delete_task',
    {
      title: 'Eliminar tarea',
      description:
        'Elimina una tarea y sus comentarios de forma permanente. Úsala solo con confirmación explícita del usuario.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        taskId: z.string().min(1),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ workspaceId, boardId, taskId }) => {
      const current = auth()
      return withErrors(async () => {
        assertWriteScope(current)
        await requireMembership(env, workspaceId, current.uid)
        await requireBoard(env, workspaceId, boardId)
        const task = await requireTask(env, workspaceId, boardId, taskId)
        const comments = await listCollection<Record<string, unknown>>(
          env,
          taskPath(workspaceId, boardId, taskId),
          'comments',
        )
        await commitWrites(
          env,
          [],
          [
            ...comments.map((comment) => ({
              path: commentPath(workspaceId, boardId, taskId, comment.id),
            })),
            { path: taskPath(workspaceId, boardId, taskId) },
          ],
        )
        await auditWrite(env, current, 'delete_task', workspaceId, {
          boardId,
          taskId,
          title: task.title,
          comments: comments.length,
        })
        return {
          deleted: true,
          taskId,
          title: task.title,
          commentsDeleted: comments.length,
        }
      })
    },
  )

  server.registerTool(
    'add_comment',
    {
      title: 'Añadir comentario',
      description: 'Añade un comentario a una tarea en nombre del usuario del token.',
      inputSchema: z.object({
        workspaceId: z.string().min(1),
        boardId: z.string().min(1),
        taskId: z.string().min(1),
        body: z.string().min(1).max(2000),
      }),
    },
    async ({ workspaceId, boardId, taskId, body }) => {
      const current = auth()
      return withErrors(async () => {
        assertWriteScope(current)
        const membership = await requireMembership(env, workspaceId, current.uid)
        await requireBoard(env, workspaceId, boardId)
        await requireTask(env, workspaceId, boardId, taskId)
        const trimmed = body.trim()
        if (!trimmed) throw new ValidationError('El comentario no puede estar vacío.')
        if (trimmed.length > 2000) {
          throw new ValidationError('El comentario no puede superar 2000 caracteres.')
        }
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const comment: TaskComment = {
          id,
          workspaceId,
          boardId,
          taskId,
          authorId: current.uid,
          authorName: membership.displayName,
          authorPhotoURL: membership.photoURL,
          body: trimmed,
          createdAt: now,
        }
        await createDocument(
          env,
          taskPath(workspaceId, boardId, taskId),
          'comments',
          id,
          {
            authorId: comment.authorId,
            authorName: comment.authorName,
            authorPhotoURL: comment.authorPhotoURL,
            body: comment.body,
            createdAt: comment.createdAt,
          },
        )
        await auditWrite(env, current, 'add_comment', workspaceId, {
          boardId,
          taskId,
          commentId: id,
          length: trimmed.length,
        })
        return { comment }
      })
    },
  )

  return server
}
