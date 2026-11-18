import type {
  CreateWorkspaceInput,
  SessionUser,
  Subscriber,
  Unsubscribe,
  WorkspaceRepository,
} from '@/domain/ports'
import type { Invite, Member, Role, Workspace } from '@/domain/entities/identity'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'
import {
  buildWorkspaceId,
  createInvite,
  isInviteExpired,
  pickWorkspaceIcon,
  validateWorkspaceName,
} from '@/domain/services/workspace-service'
import type { DemoStore } from './store'
import { createId } from './store'
import {
  getMembership,
  getWorkspace,
  listMembers,
  listWorkspacesForUser,
  memberKey,
} from './selectors'

export class DemoWorkspaceRepository implements WorkspaceRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async listForUser(uid: string): Promise<Workspace[]> {
    return listWorkspacesForUser(this.store.getState(), uid)
  }

  subscribeForUser(uid: string, callback: Subscriber<Workspace[]>): Unsubscribe {
    const emit = () => callback(listWorkspacesForUser(this.store.getState(), uid))
    emit()
    return this.store.subscribe(emit)
  }

  async get(workspaceId: string): Promise<Workspace | null> {
    return getWorkspace(this.store.getState(), workspaceId)
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const name = validateWorkspaceName(input.name)
    const state = this.store.getState()
    let id = ''
    for (let attempt = 0; attempt < 5; attempt += 1) {
      id = buildWorkspaceId(name, Math.random().toString(36).slice(2, 6))
      if (!state.workspaces[id]) break
    }
    const workspace: Workspace = {
      id,
      name,
      icon: input.icon || pickWorkspaceIcon(name),
      description: input.description.trim(),
      ownerId: input.owner.id,
      createdAt: new Date().toISOString(),
      memberIds: [input.owner.id],
    }
    const member: Member = {
      id: input.owner.id,
      workspaceId: id,
      uid: input.owner.id,
      role: 'owner',
      displayName: input.owner.displayName,
      email: input.owner.email,
      photoURL: input.owner.photoURL,
      joinedAt: workspace.createdAt,
      lastActiveAt: workspace.createdAt,
    }

    this.store.commit((draft) => {
      draft.workspaces[id] = workspace
      draft.members[memberKey(id, member.uid)] = member
      if (!draft.users[input.owner.id]) {
        draft.users[input.owner.id] = {
          id: input.owner.id,
          displayName: input.owner.displayName,
          email: input.owner.email,
          photoURL: input.owner.photoURL,
          createdAt: workspace.createdAt,
          lastActiveAt: workspace.createdAt,
        }
      }
    })
    return workspace
  }

  async update(
    workspaceId: string,
    patch: Partial<Pick<Workspace, 'name' | 'icon' | 'description'>>,
  ): Promise<void> {
    this.requireWorkspace(workspaceId)
    const name = patch.name === undefined ? undefined : validateWorkspaceName(patch.name)
    this.store.commit((draft) => {
      const workspace = draft.workspaces[workspaceId]
      if (!workspace) return
      if (name !== undefined) workspace.name = name
      if (patch.icon !== undefined) workspace.icon = patch.icon
      if (patch.description !== undefined) workspace.description = patch.description.trim()
    })
  }

  async remove(workspaceId: string): Promise<void> {
    this.requireWorkspace(workspaceId)
    this.store.commit((draft) => {
      delete draft.workspaces[workspaceId]
      for (const [key, member] of Object.entries(draft.members)) {
        if (member.workspaceId === workspaceId) delete draft.members[key]
      }
      for (const [id, channel] of Object.entries(draft.channels)) {
        if (channel.workspaceId === workspaceId) delete draft.channels[id]
      }
      for (const [id, message] of Object.entries(draft.messages)) {
        if (message.workspaceId === workspaceId) delete draft.messages[id]
      }
      for (const [id, board] of Object.entries(draft.boards)) {
        if (board.workspaceId === workspaceId) delete draft.boards[id]
      }
      for (const [id, task] of Object.entries(draft.tasks)) {
        if (task.workspaceId === workspaceId) delete draft.tasks[id]
      }
      for (const [id, comment] of Object.entries(draft.comments)) {
        if (comment.workspaceId === workspaceId) delete draft.comments[id]
      }
      for (const [id, page] of Object.entries(draft.pages)) {
        if (page.workspaceId === workspaceId) delete draft.pages[id]
      }
      for (const [id, file] of Object.entries(draft.files)) {
        if (file.workspaceId === workspaceId) delete draft.files[id]
      }
      for (const [code, invite] of Object.entries(draft.invites)) {
        if (invite.workspaceId === workspaceId) delete draft.invites[code]
      }
    })
  }

  async listMembers(workspaceId: string): Promise<Member[]> {
    return listMembers(this.store.getState(), workspaceId)
  }

  subscribeMembers(workspaceId: string, callback: Subscriber<Member[]>): Unsubscribe {
    const emit = () => callback(listMembers(this.store.getState(), workspaceId))
    emit()
    return this.store.subscribe(emit)
  }

  async addMember(
    workspaceId: string,
    member: Omit<Member, 'id' | 'workspaceId'>,
    inviteCode?: string,
  ): Promise<void> {
    this.requireWorkspace(workspaceId)
    const existing = getMembership(this.store.getState(), workspaceId, member.uid)
    if (existing) return

    if (inviteCode) {
      const invite = this.store.getState().invites[inviteCode.toUpperCase()]
      if (!invite || invite.workspaceId !== workspaceId || isInviteExpired(invite)) {
        throw new ValidationError('La invitación no es válida o ha caducado.')
      }
    }

    const next: Member = { ...member, id: member.uid, workspaceId }
    this.store.commit((draft) => {
      draft.members[memberKey(workspaceId, member.uid)] = next
      const workspace = draft.workspaces[workspaceId]
      if (workspace && !workspace.memberIds.includes(member.uid)) {
        workspace.memberIds = [...workspace.memberIds, member.uid]
      }
      if (!draft.users[member.uid]) {
        draft.users[member.uid] = {
          id: member.uid,
          displayName: member.displayName,
          email: member.email,
          photoURL: member.photoURL,
          createdAt: next.joinedAt,
          lastActiveAt: next.joinedAt,
        }
      }
    })
  }

  async updateMemberRole(workspaceId: string, uid: string, role: Role): Promise<void> {
    const member = getMembership(this.store.getState(), workspaceId, uid)
    if (!member) throw new NotFoundError('El miembro no existe.')
    if (role === member.role) return
    if (member.role === 'owner' && role !== 'owner') {
      throw new ConflictError('Transfiere la propiedad antes de cambiar el rol del owner.')
    }
    this.store.commit((draft) => {
      if (role === 'owner') {
        for (const candidate of Object.values(draft.members)) {
          if (candidate.workspaceId === workspaceId && candidate.role === 'owner') {
            candidate.role = 'admin'
          }
        }
        const workspace = draft.workspaces[workspaceId]
        if (workspace) workspace.ownerId = uid
      }
      const target = draft.members[memberKey(workspaceId, uid)]
      if (target) target.role = role
    })
  }

  async removeMember(workspaceId: string, uid: string): Promise<void> {
    const member = getMembership(this.store.getState(), workspaceId, uid)
    if (!member) throw new NotFoundError('El miembro no existe.')
    if (member.role === 'owner') {
      throw new ConflictError('El propietario no puede salir sin transferir la propiedad.')
    }
    this.store.commit((draft) => {
      delete draft.members[memberKey(workspaceId, uid)]
      const workspace = draft.workspaces[workspaceId]
      if (workspace) {
        workspace.memberIds = workspace.memberIds.filter((candidate) => candidate !== uid)
      }
    })
  }

  async createInvite(workspaceId: string, createdBy: string): Promise<Invite> {
    this.requireWorkspace(workspaceId)
    let invite = createInvite(workspaceId, createdBy)
    let attempts = 0
    while (this.store.getState().invites[invite.code] && attempts < 5) {
      invite = createInvite(workspaceId, createdBy)
      attempts += 1
    }
    this.store.commit((draft) => {
      draft.invites[invite.code] = invite
    })
    return invite
  }

  async listInvites(workspaceId: string): Promise<Invite[]> {
    return Object.values(this.store.getState().invites)
      .filter((invite) => invite.workspaceId === workspaceId && !isInviteExpired(invite))
  }

  async revokeInvite(code: string): Promise<void> {
    this.store.commit((draft) => {
      delete draft.invites[code.toUpperCase()]
    })
  }

  async getInvite(code: string): Promise<Invite | null> {
    return this.store.getState().invites[code.toUpperCase()] ?? null
  }

  async acceptInvite(code: string, user: SessionUser): Promise<Workspace> {
    const invite = await this.getInvite(code)
    if (!invite) throw new ValidationError('La invitación no existe.')
    if (isInviteExpired(invite)) throw new ValidationError('La invitación ha caducado.')
    const workspace = this.requireWorkspace(invite.workspaceId)
    const existing = getMembership(this.store.getState(), workspace.id, user.id)
    if (existing) return workspace

    const member: Member = {
      id: user.id,
      workspaceId: workspace.id,
      uid: user.id,
      role: 'member',
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }
    this.store.commit((draft) => {
      draft.members[memberKey(workspace.id, user.id)] = member
      const target = draft.workspaces[workspace.id]
      if (target && !target.memberIds.includes(user.id)) {
        target.memberIds = [...target.memberIds, user.id]
      }
      if (!draft.users[user.id]) {
        draft.users[user.id] = {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: member.joinedAt,
          lastActiveAt: member.joinedAt,
        }
      }
    })
    return workspace
  }

  private requireWorkspace(workspaceId: string): Workspace {
    const workspace = getWorkspace(this.store.getState(), workspaceId)
    if (!workspace) throw new NotFoundError('El espacio de trabajo no existe.')
    return workspace
  }
}

export function newMemberId(): string {
  return createId('member')
}
