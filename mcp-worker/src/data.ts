import type { AuthProps } from './auth'
import type { Env } from './env'
import { getDocument, listCollection, queryCollection } from './firestore'
import {
  ForbiddenError,
  NotFoundError,
  mapBoard,
  mapMember,
  mapTask,
  mapWorkspace,
  type Board,
  type Member,
  type Task,
  type Workspace,
} from './domain'

export function memberPath(workspaceId: string, uid: string): string {
  return `workspaces/${workspaceId}/members/${uid}`
}

export function boardPath(workspaceId: string, boardId: string): string {
  return `workspaces/${workspaceId}/boards/${boardId}`
}

export function taskPath(workspaceId: string, boardId: string, taskId: string): string {
  return `${boardPath(workspaceId, boardId)}/tasks/${taskId}`
}

export function commentPath(
  workspaceId: string,
  boardId: string,
  taskId: string,
  commentId: string,
): string {
  return `${taskPath(workspaceId, boardId, taskId)}/comments/${commentId}`
}

export async function getMembership(
  env: Env,
  workspaceId: string,
  uid: string,
): Promise<Member | null> {
  const document = await getDocument<Record<string, unknown>>(
    env,
    memberPath(workspaceId, uid),
  )
  return document ? mapMember(document.id, document.data) : null
}

export async function requireMembership(
  env: Env,
  workspaceId: string,
  uid: string,
): Promise<Member> {
  const membership = await getMembership(env, workspaceId, uid)
  if (!membership) throw new ForbiddenError('No perteneces a este espacio.')
  return membership
}

export function assertWriteScope(auth: AuthProps): void {
  if (!auth.scopes.includes('openqomu:write')) {
    throw new ForbiddenError('El token no tiene el scope openqomu:write.')
  }
}

export async function listWorkspacesForUser(
  env: Env,
  uid: string,
): Promise<Workspace[]> {
  const documents = await queryCollection<Record<string, unknown>>(
    env,
    '',
    'workspaces',
    'memberIds',
    uid,
    100,
  )
  return documents
    .map((document) => mapWorkspace(document.id, document.data))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function requireWorkspace(env: Env, workspaceId: string): Promise<Workspace> {
  const document = await getDocument<Record<string, unknown>>(env, `workspaces/${workspaceId}`)
  if (!document) throw new NotFoundError('El espacio no existe.')
  return mapWorkspace(document.id, document.data)
}

export async function listMembers(env: Env, workspaceId: string): Promise<Member[]> {
  const documents = await listCollection<Record<string, unknown>>(
    env,
    `workspaces/${workspaceId}`,
    'members',
  )
  return documents
    .map((document) => mapMember(document.id, document.data))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
}

export async function listBoards(env: Env, workspaceId: string): Promise<Board[]> {
  const documents = await listCollection<Record<string, unknown>>(
    env,
    `workspaces/${workspaceId}`,
    'boards',
  )
  return documents
    .map((document) => mapBoard(document.id, workspaceId, document.data))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function requireBoard(
  env: Env,
  workspaceId: string,
  boardId: string,
): Promise<Board> {
  const document = await getDocument<Record<string, unknown>>(
    env,
    boardPath(workspaceId, boardId),
  )
  if (!document) throw new NotFoundError('El tablero no existe.')
  return mapBoard(document.id, workspaceId, document.data)
}

export async function listTasks(env: Env, workspaceId: string, boardId: string): Promise<Task[]> {
  const documents = await listCollection<Record<string, unknown>>(
    env,
    boardPath(workspaceId, boardId),
    'tasks',
  )
  return documents
    .map((document) => mapTask(document.id, workspaceId, boardId, document.data))
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export async function requireTask(
  env: Env,
  workspaceId: string,
  boardId: string,
  taskId: string,
): Promise<Task> {
  const document = await getDocument<Record<string, unknown>>(
    env,
    taskPath(workspaceId, boardId, taskId),
  )
  if (!document) throw new NotFoundError('La tarea no existe.')
  return mapTask(document.id, workspaceId, boardId, document.data)
}
