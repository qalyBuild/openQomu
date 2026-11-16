import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import type {
  ChannelInput,
  ChannelRepository,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Channel } from '@/domain/entities/chat'
import { ConflictError, NotFoundError } from '@/domain/errors'
import { channelNameKey, normalizeChannelName } from '@/domain/services/workspace-service'
import { getFirebaseDb } from './client'
import { deleteCollectionDocs, nowIso } from './firestore-utils'
import { mapChannel } from './mappers'

function db() {
  return getFirebaseDb()
}

function channelsCol(workspaceId: string) {
  return collection(db(), 'workspaces', workspaceId, 'channels')
}

function channelRef(workspaceId: string, channelId: string) {
  return doc(db(), 'workspaces', workspaceId, 'channels', channelId)
}

function sorted(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export class FirebaseChannelRepository implements ChannelRepository {
  async list(workspaceId: string): Promise<Channel[]> {
    const snapshot = await getDocs(channelsCol(workspaceId))
    return sorted(
      snapshot.docs.map((document) => mapChannel(document.id, workspaceId, document.data())),
    )
  }

  subscribe(workspaceId: string, callback: Subscriber<Channel[]>): Unsubscribe {
    return onSnapshot(
      channelsCol(workspaceId),
      (snapshot) => {
        callback(
          sorted(
            snapshot.docs.map((document) =>
              mapChannel(document.id, workspaceId, document.data()),
            ),
          ),
        )
      },
      (error) => console.error('[openqomu] channels snapshot', error),
    )
  }

  async create(input: ChannelInput): Promise<Channel> {
    const name = normalizeChannelName(input.name)
    const existing = await this.list(input.workspaceId)
    if (
        existing.some(
          (channel) => channelNameKey(channel.name) === channelNameKey(name) && !channel.archived,
        )
      ) {
      throw new ConflictError(`El canal #${name} ya existe.`)
    }
    const now = nowIso()
    const memberIds =
      input.type === 'private' ? [...new Set([input.createdBy, ...(input.memberIds ?? [])])] : []
    const reference = await addDoc(channelsCol(input.workspaceId), {
      name,
      description: input.description.trim(),
      type: input.type,
      createdBy: input.createdBy,
      createdAt: now,
      archived: false,
      memberIds,
    })
    return {
      id: reference.id,
      workspaceId: input.workspaceId,
      name,
      description: input.description.trim(),
      type: input.type,
      createdBy: input.createdBy,
      createdAt: now,
      archived: false,
      memberIds,
    }
  }

  async update(
    workspaceId: string,
    channelId: string,
    patch: Partial<Pick<Channel, 'name' | 'description' | 'archived' | 'memberIds'>>,
  ): Promise<void> {
    const data: Record<string, string | boolean | string[]> = {}
    if (patch.name !== undefined) {
      const name = normalizeChannelName(patch.name)
      const existing = await this.list(workspaceId)
      if (
        existing.some(
          (channel) =>
            channel.id !== channelId &&
            channelNameKey(channel.name) === channelNameKey(name) &&
            !channel.archived,
        )
      ) {
        throw new ConflictError(`El canal #${name} ya existe.`)
      }
      data.name = name
    }
    if (patch.description !== undefined) data.description = patch.description.trim()
    if (patch.archived !== undefined) data.archived = patch.archived
    if (patch.memberIds !== undefined) {
      data.memberIds = [...new Set(patch.memberIds)]
    }
    if (Object.keys(data).length === 0) return
    await updateDoc(channelRef(workspaceId, channelId), data)
  }

  async remove(workspaceId: string, channelId: string): Promise<void> {
    const reference = channelRef(workspaceId, channelId)
    await deleteCollectionDocs(db(), collection(db(), reference.path, 'messages'))
    try {
      await deleteDoc(reference)
    } catch {
      throw new NotFoundError('El canal no existe.')
    }
  }
}
