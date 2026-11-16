import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, ref as storageRef } from 'firebase/storage'
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
import { getFirebaseDb, getFirebaseStorage } from './client'
import { deleteCollectionDocs, nowIso } from './firestore-utils'
import { mapInvite, mapMember, mapWorkspace } from './mappers'

function db() {
  return getFirebaseDb()
}

function workspaceRef(workspaceId: string) {
  return doc(db(), 'workspaces', workspaceId)
}

function membersCol(workspaceId: string) {
  return collection(db(), 'workspaces', workspaceId, 'members')
}

function memberRef(workspaceId: string, uid: string) {
  return doc(db(), 'workspaces', workspaceId, 'members', uid)
}

function sortMembers(members: Member[]): Member[] {
  const weight = (role: Role) => (role === 'owner' ? 0 : role === 'admin' ? 1 : 2)
  return [...members].sort(
    (a, b) => weight(a.role) - weight(b.role) || a.displayName.localeCompare(b.displayName, 'es'),
  )
}

export class FirebaseWorkspaceRepository implements WorkspaceRepository {
  async listForUser(uid: string): Promise<Workspace[]> {
    const snapshot = await getDocs(
      query(collection(db(), 'workspaces'), where('memberIds', 'array-contains', uid)),
    )
    return snapshot.docs
      .map((document) => mapWorkspace(document.id, document.data()))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  subscribeForUser(
    uid: string,
    callback: Subscriber<Workspace[]>,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db(), 'workspaces'), where('memberIds', 'array-contains', uid)),
      (snapshot) => {
        callback(
          snapshot.docs
            .map((document) => mapWorkspace(document.id, document.data()))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
      },
      (error) => {
        console.error('[openqomu] workspaces snapshot', error)
        onError?.(error as Error)
      },
    )
  }

  async get(workspaceId: string): Promise<Workspace | null> {
    const snapshot = await getDoc(workspaceRef(workspaceId))
    return snapshot.exists() ? mapWorkspace(snapshot.id, snapshot.data()) : null
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const name = validateWorkspaceName(input.name)
    const id = buildWorkspaceId(name, Math.random().toString(36).slice(2, 6))
    const now = nowIso()
    const workspace: Workspace = {
      id,
      name,
      icon: input.icon || pickWorkspaceIcon(name),
      description: input.description.trim(),
      ownerId: input.owner.id,
      createdAt: now,
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
      joinedAt: now,
      lastActiveAt: now,
    }
    const batch = writeBatch(db())
    batch.set(workspaceRef(id), {
      name: workspace.name,
      icon: workspace.icon,
      description: workspace.description,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt,
      memberIds: workspace.memberIds,
    })
    await batch.commit()
    // El documento del miembro se crea después: las reglas confirman que el
    // workspace ya existe y que su owner es el usuario actual.
    await setDoc(memberRef(id, member.uid), {
      uid: member.uid,
      role: member.role,
      displayName: member.displayName,
      email: member.email,
      photoURL: member.photoURL,
      joinedAt: member.joinedAt,
      lastActiveAt: member.lastActiveAt,
    })
    return workspace
  }

  async update(
    workspaceId: string,
    patch: Partial<Pick<Workspace, 'name' | 'icon' | 'description'>>,
  ): Promise<void> {
    const data: Record<string, string> = {}
    if (patch.name !== undefined) data.name = validateWorkspaceName(patch.name)
    if (patch.icon !== undefined) data.icon = patch.icon
    if (patch.description !== undefined) data.description = patch.description.trim()
    if (Object.keys(data).length === 0) return
    await updateDoc(workspaceRef(workspaceId), data)
  }

  async remove(workspaceId: string): Promise<void> {
    const database = db()
    const channels = await getDocs(collection(database, 'workspaces', workspaceId, 'channels'))
    for (const channel of channels.docs) {
      await deleteCollectionDocs(database, collection(database, channel.ref.path, 'messages'))
      await deleteDoc(channel.ref)
    }
    const boards = await getDocs(collection(database, 'workspaces', workspaceId, 'boards'))
    for (const board of boards.docs) {
      const tasks = await getDocs(collection(database, board.ref.path, 'tasks'))
      for (const task of tasks.docs) {
        await deleteCollectionDocs(database, collection(database, task.ref.path, 'comments'))
        await deleteDoc(task.ref)
      }
      await deleteDoc(board.ref)
    }
    const files = await getDocs(collection(database, 'workspaces', workspaceId, 'files'))
    for (const file of files.docs) {
      const path = typeof file.data().path === 'string' ? (file.data().path as string) : ''
      if (path) {
        try {
          await deleteObject(storageRef(getFirebaseStorage(), path))
        } catch {
          // El archivo ya no existe en Storage.
        }
      }
      await deleteDoc(file.ref)
    }
    await deleteCollectionDocs(database, collection(database, 'workspaces', workspaceId, 'pages'))
    await deleteCollectionDocs(database, membersCol(workspaceId))
    // Las invitaciones se dejan huérfanas a propósito: al no poder listarlas
    // (los códigos son secretos), el flujo de unión comprueba que el workspace
    // siga existiendo. Un código huérfano no concede acceso.
    await deleteDoc(workspaceRef(workspaceId))
  }

  async listMembers(workspaceId: string): Promise<Member[]> {
    const snapshot = await getDocs(membersCol(workspaceId))
    return sortMembers(
      snapshot.docs.map((document) => mapMember(document.id, workspaceId, document.data())),
    )
  }

  subscribeMembers(workspaceId: string, callback: Subscriber<Member[]>): Unsubscribe {
    return onSnapshot(
      membersCol(workspaceId),
      (snapshot) => {
        callback(
          sortMembers(
            snapshot.docs.map((document) =>
              mapMember(document.id, workspaceId, document.data()),
            ),
          ),
        )
      },
      (error) => console.error('[openqomu] members snapshot', error),
    )
  }

  async addMember(
    workspaceId: string,
    member: Omit<Member, 'id' | 'workspaceId'>,
    inviteCode?: string,
  ): Promise<void> {
    if (inviteCode) {
      const invite = await this.getInvite(inviteCode)
      if (!invite || invite.workspaceId !== workspaceId || isInviteExpired(invite)) {
        throw new ValidationError('La invitación no es válida o ha caducado.')
      }
    }
    const batch = writeBatch(db())
    batch.set(memberRef(workspaceId, member.uid), {
      uid: member.uid,
      role: member.role,
      displayName: member.displayName,
      email: member.email,
      photoURL: member.photoURL,
      joinedAt: member.joinedAt,
      lastActiveAt: member.lastActiveAt,
      ...(inviteCode ? { inviteCode } : {}),
    })
    batch.update(workspaceRef(workspaceId), { memberIds: arrayUnion(member.uid) })
    await batch.commit()
  }

  async updateMemberRole(workspaceId: string, uid: string, role: Role): Promise<void> {
    const workspace = await this.get(workspaceId)
    if (!workspace) throw new NotFoundError('El espacio de trabajo no existe.')
    if (uid === workspace.ownerId && role !== 'owner') {
      throw new ConflictError('Transfiere la propiedad antes de cambiar el rol del owner.')
    }
    const batch = writeBatch(db())
    if (role === 'owner') {
      batch.update(memberRef(workspaceId, workspace.ownerId), { role: 'admin' })
      batch.update(workspaceRef(workspaceId), { ownerId: uid })
    }
    batch.update(memberRef(workspaceId, uid), { role })
    await batch.commit()
  }

  async removeMember(workspaceId: string, uid: string): Promise<void> {
    const workspace = await this.get(workspaceId)
    if (!workspace) throw new NotFoundError('El espacio de trabajo no existe.')
    if (workspace.ownerId === uid) {
      throw new ConflictError('El propietario no puede salir sin transferir la propiedad.')
    }
    const batch = writeBatch(db())
    batch.delete(memberRef(workspaceId, uid))
    batch.update(workspaceRef(workspaceId), { memberIds: arrayRemove(uid) })
    await batch.commit()
  }

  async createInvite(workspaceId: string, createdBy: string): Promise<Invite> {
    let invite = createInvite(workspaceId, createdBy)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await getDoc(doc(db(), 'invites', invite.code))
      if (!existing.exists()) break
      invite = createInvite(workspaceId, createdBy)
    }
    await setDoc(doc(db(), 'invites', invite.code), {
      workspaceId: invite.workspaceId,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      expiresAtMs: new Date(invite.expiresAt).getTime(),
    })
    return invite
  }

  async getInvite(code: string): Promise<Invite | null> {
    const snapshot = await getDoc(doc(db(), 'invites', code.toUpperCase()))
    return snapshot.exists() ? mapInvite(snapshot.id, snapshot.data()) : null
  }

  async acceptInvite(code: string, user: SessionUser): Promise<Workspace> {
    const invite = await this.getInvite(code)
    if (!invite) throw new ValidationError('La invitación no existe.')
    if (isInviteExpired(invite)) throw new ValidationError('La invitación ha caducado.')

    // No se puede leer el workspace antes de ser miembro. Se comprueba el
    // propio documento de miembro (permitido por reglas) para que la operación
    // sea idempotente sin degradar roles existentes.
    const existingMembership = await getDoc(memberRef(invite.workspaceId, user.id))
    if (existingMembership.exists()) {
      const workspace = await this.get(invite.workspaceId)
      if (!workspace) throw new NotFoundError('El espacio de trabajo no existe.')
      return workspace
    }

    const now = nowIso()
    const member: Member = {
      id: user.id,
      workspaceId: invite.workspaceId,
      uid: user.id,
      role: 'member',
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      joinedAt: now,
      lastActiveAt: now,
    }
    const batch = writeBatch(db())
    batch.set(memberRef(invite.workspaceId, user.id), {
      uid: member.uid,
      role: member.role,
      displayName: member.displayName,
      email: member.email,
      photoURL: member.photoURL,
      joinedAt: member.joinedAt,
      lastActiveAt: member.lastActiveAt,
      inviteCode: code.toUpperCase(),
    })
    batch.update(workspaceRef(invite.workspaceId), { memberIds: arrayUnion(user.id) })
    await batch.commit()

    // Tras unirse, ya puede leer el workspace para devolver sus datos.
    const workspace = await this.get(invite.workspaceId)
    if (!workspace) throw new NotFoundError('El espacio de trabajo no existe.')
    return workspace
  }
}
