import type { User } from '@/domain/entities/identity'
import type { SessionUser, Subscriber, Unsubscribe, UserRepository } from '@/domain/ports'
import type { DemoStore } from './store'

export class DemoUserRepository implements UserRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async getProfile(uid: string): Promise<User | null> {
    return this.store.getState().users[uid] ?? null
  }

  async ensureProfile(user: SessionUser): Promise<User> {
    const existing = this.store.getState().users[user.id]
    if (existing) {
      const displayName = existing.displayName.trim() || user.displayName
      if (
        existing.email !== user.email ||
        existing.photoURL !== user.photoURL ||
        existing.displayName !== displayName
      ) {
        const updated: User = {
          ...existing,
          displayName,
          email: user.email,
          photoURL: user.photoURL,
          lastActiveAt: new Date().toISOString(),
        }
        this.store.commit((draft) => {
          draft.users[user.id] = updated
        })
        return updated
      }
      return existing
    }

    const profile: User = {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }
    this.store.commit((draft) => {
      draft.users[user.id] = profile
    })
    return profile
  }

  async updateProfile(
    uid: string,
    patch: Partial<Pick<User, 'displayName' | 'themeId'>>,
  ): Promise<void> {
    const existing = this.store.getState().users[uid]
    if (!existing) return
    this.store.commit((draft) => {
      draft.users[uid] = {
        ...draft.users[uid],
        ...(patch.displayName ? { displayName: patch.displayName.trim() } : {}),
        ...(patch.themeId ? { themeId: patch.themeId } : {}),
      }
      for (const member of Object.values(draft.members)) {
        if (member.uid === uid && patch.displayName) {
          member.displayName = patch.displayName.trim()
        }
      }
    })
  }

  async touch(uid: string): Promise<void> {
    if (!this.store.getState().users[uid]) return
    this.store.commit((draft) => {
      const now = new Date().toISOString()
      if (draft.users[uid]) draft.users[uid].lastActiveAt = now
      for (const member of Object.values(draft.members)) {
        if (member.uid === uid) member.lastActiveAt = now
      }
    })
  }

  subscribeProfile(uid: string, callback: Subscriber<User | null>): Unsubscribe {
    const emit = () => callback(this.store.getState().users[uid] ?? null)
    emit()
    return this.store.subscribe(emit)
  }
}
