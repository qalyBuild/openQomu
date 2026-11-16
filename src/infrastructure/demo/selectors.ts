import type { Channel, FileFolder, FileMeta, Message } from '@/domain/entities/chat'
import type { Invite, Member, Workspace } from '@/domain/entities/identity'
import type { Board, Task, TaskComment } from '@/domain/entities/kanban'
import type { Page } from '@/domain/entities/pages'
import type { DemoState } from './seed'

export function memberKey(workspaceId: string, uid: string): string {
  return `${workspaceId}:${uid}`
}

export function getMembership(
  state: DemoState,
  workspaceId: string,
  uid: string,
): Member | undefined {
  return state.members[memberKey(workspaceId, uid)]
}

export function isMember(state: DemoState, workspaceId: string, uid: string): boolean {
  return Boolean(getMembership(state, workspaceId, uid))
}

export function listWorkspacesForUser(state: DemoState, uid: string): Workspace[] {
  return Object.values(state.members)
    .filter((member) => member.uid === uid)
    .map((member) => state.workspaces[member.workspaceId])
    .filter((workspace): workspace is Workspace => Boolean(workspace))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function listMembers(state: DemoState, workspaceId: string): Member[] {
  return Object.values(state.members)
    .filter((member) => member.workspaceId === workspaceId)
    .sort((a, b) => roleWeight(a.role) - roleWeight(b.role) || a.displayName.localeCompare(b.displayName, 'es'))
}

function roleWeight(role: Member['role']): number {
  return role === 'owner' ? 0 : role === 'admin' ? 1 : 2
}

export function listChannels(state: DemoState, workspaceId: string): Channel[] {
  return Object.values(state.channels)
    .filter((channel) => channel.workspaceId === workspaceId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function listMessages(
  state: DemoState,
  workspaceId: string,
  channelId: string,
  limit = 200,
): Message[] {
  const messages = Object.values(state.messages)
    .filter((message) => message.workspaceId === workspaceId && message.channelId === channelId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  return messages.slice(Math.max(0, messages.length - limit))
}

export function listBoards(state: DemoState, workspaceId: string): Board[] {
  return Object.values(state.boards)
    .filter((board) => board.workspaceId === workspaceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function listTasks(state: DemoState, workspaceId: string, boardId: string): Task[] {
  return Object.values(state.tasks)
    .filter((task) => task.workspaceId === workspaceId && task.boardId === boardId)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export function listComments(
  state: DemoState,
  workspaceId: string,
  boardId: string,
  taskId: string,
): TaskComment[] {
  return Object.values(state.comments)
    .filter(
      (comment) =>
        comment.workspaceId === workspaceId &&
        comment.boardId === boardId &&
        comment.taskId === taskId,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function listPages(state: DemoState, workspaceId: string): Page[] {
  return Object.values(state.pages)
    .filter((page) => page.workspaceId === workspaceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function listFiles(state: DemoState, workspaceId: string): FileMeta[] {
  return Object.values(state.files)
    .filter((file) => file.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listFolders(state: DemoState, workspaceId: string): FileFolder[] {
  return Object.values(state.folders ?? {})
    .filter((folder) => folder.workspaceId === workspaceId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function findInvite(state: DemoState, code: string): Invite | null {
  return state.invites[code.toUpperCase()] ?? null
}

export function getWorkspace(state: DemoState, workspaceId: string): Workspace | null {
  return state.workspaces[workspaceId] ?? null
}
