import { describe, expect, it } from 'vitest'
import type { Message } from '@/domain/entities/chat'
import type { FileMeta } from '@/domain/entities/chat'
import type { Task } from '@/domain/entities/kanban'
import {
  assertCan,
  can,
  canChangeRole,
  canDeleteFile,
  canDeleteMessage,
  canDeleteTask,
  canInvite,
  canManageWorkspace,
  canRemoveMember,
} from './permission-service'

const message = { authorId: 'u1' } as Message
const file = { uploadedBy: 'u1' } as FileMeta
const task = { createdBy: 'u1' } as Task

describe('permission-service', () => {
  it('aplica la matriz por rol', () => {
    expect(can('owner', 'workspace.delete')).toBe(true)
    expect(can('admin', 'workspace.delete')).toBe(false)
    expect(can('admin', 'workspace.transfer')).toBe(false)
    expect(can('admin', 'member.manage')).toBe(true)
    expect(can('member', 'channel.create')).toBe(true)
    expect(can('member', 'member.invite')).toBe(false)
    expect(can('member', 'board.manage')).toBe(false)
    expect(canManageWorkspace('owner')).toBe(true)
    expect(canInvite('admin')).toBe(true)
    expect(() => assertCan('member', 'member.manage')).toThrow('permisos')
  })

  it('permite borrar lo propio a cualquier rol', () => {
    expect(canDeleteMessage('member', message, 'u1')).toBe(true)
    expect(canDeleteMessage('member', message, 'u2')).toBe(false)
    expect(canDeleteMessage('admin', message, 'u2')).toBe(true)
    expect(canDeleteFile('member', file, 'u1')).toBe(true)
    expect(canDeleteFile('member', file, 'u2')).toBe(false)
    expect(canDeleteFile('admin', file, 'u2')).toBe(true)
    expect(canDeleteTask('member', task, 'u1')).toBe(true)
    expect(canDeleteTask('admin', task, 'u2')).toBe(true)
  })

  it('protege la propiedad del workspace', () => {
    expect(canChangeRole('owner', 'member', 'admin')).toBe(true)
    expect(canChangeRole('admin', 'member', 'admin')).toBe(true)
    expect(canChangeRole('admin', 'member', 'owner')).toBe(false)
    expect(canChangeRole('owner', 'admin', 'member')).toBe(true)
    expect(canChangeRole('member', 'member', 'admin')).toBe(false)
    expect(canRemoveMember('owner', 'admin')).toBe(true)
    expect(canRemoveMember('admin', 'member')).toBe(true)
    expect(canRemoveMember('admin', 'admin')).toBe(false)
    expect(canRemoveMember('owner', 'owner')).toBe(false)
    expect(canRemoveMember('member', 'member')).toBe(false)
  })
})
