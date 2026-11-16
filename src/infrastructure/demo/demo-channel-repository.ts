import type {
  ChannelInput,
  ChannelRepository,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Channel } from '@/domain/entities/chat'
import { ConflictError, NotFoundError } from '@/domain/errors'
import { channelNameKey, normalizeChannelName } from '@/domain/services/workspace-service'
import type { DemoStore } from './store'
import { createId } from './store'
import { getWorkspace, listChannels } from './selectors'

export class DemoChannelRepository implements ChannelRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async list(workspaceId: string): Promise<Channel[]> {
    return listChannels(this.store.getState(), workspaceId)
  }

  subscribe(workspaceId: string, callback: Subscriber<Channel[]>): Unsubscribe {
    const emit = () => callback(listChannels(this.store.getState(), workspaceId))
    emit()
    return this.store.subscribe(emit)
  }

  async create(input: ChannelInput): Promise<Channel> {
    if (!getWorkspace(this.store.getState(), input.workspaceId)) {
      throw new NotFoundError('El espacio de trabajo no existe.')
    }
    const name = normalizeChannelName(input.name)
    const duplicated = listChannels(this.store.getState(), input.workspaceId).some(
      (channel) => channelNameKey(channel.name) === channelNameKey(name) && !channel.archived,
    )
    if (duplicated) throw new ConflictError(`El canal #${name} ya existe.`)

    const channel: Channel = {
      id: createId('ch'),
      workspaceId: input.workspaceId,
      name,
      description: input.description.trim(),
      type: input.type,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      archived: false,
      memberIds:
        input.type === 'private'
          ? [...new Set([input.createdBy, ...(input.memberIds ?? [])])]
          : [],
    }
    this.store.commit((draft) => {
      draft.channels[channel.id] = channel
    })
    return channel
  }

  async update(
    workspaceId: string,
    channelId: string,
    patch: Partial<Pick<Channel, 'name' | 'description' | 'archived' | 'memberIds'>>,
  ): Promise<void> {
    const channel = this.store.getState().channels[channelId]
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new NotFoundError('El canal no existe.')
    }
    let name: string | undefined
    if (patch.name !== undefined) {
      const nextName = normalizeChannelName(patch.name)
      name = nextName
      const duplicated = listChannels(this.store.getState(), workspaceId).some(
        (candidate) =>
          candidate.id !== channelId &&
          channelNameKey(candidate.name) === channelNameKey(nextName) &&
          !candidate.archived,
      )
      if (duplicated) throw new ConflictError(`El canal #${nextName} ya existe.`)
    }
    this.store.commit((draft) => {
      const target = draft.channels[channelId]
      if (!target) return
      if (name !== undefined) target.name = name
      if (patch.description !== undefined) target.description = patch.description.trim()
      if (patch.archived !== undefined) target.archived = patch.archived
      if (patch.memberIds !== undefined) {
        target.memberIds =
          target.type === 'private'
            ? [...new Set([target.createdBy, ...patch.memberIds])]
            : []
      }
    })
  }

  async remove(workspaceId: string, channelId: string): Promise<void> {
    const channel = this.store.getState().channels[channelId]
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new NotFoundError('El canal no existe.')
    }
    this.store.commit((draft) => {
      delete draft.channels[channelId]
      for (const [id, message] of Object.entries(draft.messages)) {
        if (message.channelId === channelId) delete draft.messages[id]
      }
    })
  }
}
