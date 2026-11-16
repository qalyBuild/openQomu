import type { FileMeta } from '@/domain/entities/chat'
import type { Role } from '@/domain/entities/identity'
import type { Message } from '@/domain/entities/chat'
import type { Task } from '@/domain/entities/kanban'
import { PermissionError } from '@/domain/errors'

export type PermissionAction =
  | 'workspace.manage'
  | 'workspace.delete'
  | 'workspace.transfer'
  | 'member.invite'
  | 'member.manage'
  | 'channel.create'
  | 'channel.manage'
  | 'board.create'
  | 'board.manage'
  | 'page.create'
  | 'page.manage'
  | 'message.deleteAny'
  | 'task.deleteAny'
  | 'file.deleteAny'

const ADMIN_PERMISSIONS: PermissionAction[] = [
  'workspace.manage',
  'member.invite',
  'member.manage',
  'channel.create',
  'channel.manage',
  'board.create',
  'board.manage',
  'page.create',
  'page.manage',
  'message.deleteAny',
  'task.deleteAny',
  'file.deleteAny',
]

const PERMISSIONS: Record<Role, ReadonlySet<PermissionAction>> = {
  owner: new Set<PermissionAction>([
    ...ADMIN_PERMISSIONS,
    'workspace.delete',
    'workspace.transfer',
  ]),
  admin: new Set<PermissionAction>(ADMIN_PERMISSIONS),
  member: new Set<PermissionAction>(['channel.create', 'board.create', 'page.create']),
}

export function can(role: Role, action: PermissionAction): boolean {
  return PERMISSIONS[role].has(action)
}

export function assertCan(role: Role, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new PermissionError()
  }
}

export function canManageWorkspace(role: Role): boolean {
  return can(role, 'workspace.manage')
}

export function canInvite(role: Role): boolean {
  return can(role, 'member.invite')
}

export function canDeleteMessage(role: Role, message: Message, uid: string): boolean {
  return message.authorId === uid || can(role, 'message.deleteAny')
}

export function canDeleteFile(role: Role, file: FileMeta, uid: string): boolean {
  return file.uploadedBy === uid || can(role, 'file.deleteAny')
}

export function canDeleteTask(role: Role, task: Task, uid: string): boolean {
  return task.createdBy === uid || can(role, 'task.deleteAny')
}

export function canChangeRole(actorRole: Role, targetRole: Role, nextRole: Role): boolean {
  if (!can(actorRole, 'member.manage')) return false
  // Solo el owner puede nombrar/retirar owners.
  if (nextRole === 'owner' || targetRole === 'owner') return actorRole === 'owner'
  return true
}

export function canRemoveMember(actorRole: Role, targetRole: Role): boolean {
  if (targetRole === 'owner') return false
  if (actorRole === 'owner') return true
  if (actorRole === 'admin') return targetRole === 'member'
  return false
}
