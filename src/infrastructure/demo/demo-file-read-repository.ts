import type { FileReadRepository, Subscriber, Unsubscribe } from '@/domain/ports'
import type { DemoStore } from './store'

export class DemoFileReadRepository implements FileReadRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  subscribe(workspaceId: string, uid: string, callback: Subscriber<number>): Unsubscribe {
    const key = JSON.stringify([workspaceId, uid])
    const emit = () => callback(this.store.getState().fileReads?.[key] ?? 0)
    emit()
    return this.store.subscribe(emit)
  }

  async advance(workspaceId: string, uid: string, through: number): Promise<void> {
    const key = JSON.stringify([workspaceId, uid])
    if ((this.store.getState().fileReads?.[key] ?? 0) >= through) return
    this.store.commit((draft) => {
      draft.fileReads ??= {}
      draft.fileReads[key] = through
    })
  }
}
