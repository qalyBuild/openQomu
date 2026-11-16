import type { DemoState } from './seed'
import { createDemoState } from './seed'
import type { Unsubscribe } from '@/domain/ports'
import { DEFAULT_BOARD_COLUMNS, isDependentsColumn, type Task } from '@/domain/entities/kanban'

const STORAGE_KEY = 'openqomu.demo.state.v2'
const SCHEMA_VERSION = 2

interface Envelope {
  version: number
  state: DemoState
}

export interface DemoStoreOptions {
  seed?: boolean
  persist?: boolean
  storageKey?: string
}

export type StoreListener = () => void

/**
 * Estado compartido del modo demo con persistencia en localStorage.
 * Cada mutación produce un snapshot nuevo (inmutable para los suscriptores).
 */
export class DemoStore {
  private state: DemoState
  private listeners = new Set<StoreListener>()
  private readonly persist: boolean
  private readonly storageKey: string

  constructor(options: DemoStoreOptions = {}) {
    this.persist = options.persist ?? true
    this.storageKey = options.storageKey ?? STORAGE_KEY
    const loaded = this.persist && options.seed !== false ? this.load() : null
    this.state = loaded ?? (options.seed === false ? emptyState() : createDemoState())

    if (this.persist && typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent)
    }
    if (options.seed !== false && this.persist) this.save()
  }

  getState(): DemoState {
    return this.state
  }

  subscribe(listener: StoreListener): Unsubscribe {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  commit(mutator: (draft: DemoState) => void): void {
    const draft = structuredClone(this.state)
    mutator(draft)
    this.state = draft
    this.save()
    this.emit()
  }

  reset(): void {
    this.state = createDemoState()
    this.save()
    this.emit()
  }

  dispose(): void {
    this.listeners.clear()
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private load(): DemoState | null {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Envelope
      if (parsed.version !== SCHEMA_VERSION || !parsed.state?.workspaces) return null
      const state = parsed.state
      state.folders ??= {}
      state.typing ??= {}
      state.reads ??= {}
      state.tasks ??= {}
      const dependents = DEFAULT_BOARD_COLUMNS.find(isDependentsColumn)
      for (const board of Object.values(state.boards ?? {})) {
        board.columns ??= []
        board.customLabels ??= []
        if (dependents && !board.columns.some(isDependentsColumn)) {
          board.columns = [{ ...dependents }, ...board.columns]
        }
      }
      for (const task of Object.values(state.tasks)) {
        const legacy = (task as Task & { dependsOnTaskId?: string | null }).dependsOnTaskId
        task.dependsOnTaskIds ??= legacy ? [legacy] : []
      }
      for (const file of Object.values(state.files ?? {})) {
        file.folderId ??= null
        file.trashedAt ??= null
        file.updatedAt ??= file.createdAt
        file.backend ??= 'local'
      }
      return state
    } catch {
      return null
    }
  }

  private save(): void {
    if (!this.persist) return
    try {
      const envelope: Envelope = { version: SCHEMA_VERSION, state: this.state }
      localStorage.setItem(this.storageKey, JSON.stringify(envelope))
    } catch {
      // Cuota agotada o almacenamiento bloqueado: la app sigue en memoria.
    }
  }

  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.key !== this.storageKey || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue) as Envelope
      if (parsed.version === SCHEMA_VERSION && parsed.state) {
        this.state = parsed.state
        this.emit()
      }
    } catch {
      // Ignora escrituras corruptas de otras pestañas.
    }
  }
}

function emptyState(): DemoState {
  return {
    users: {},
    workspaces: {},
    members: {},
    invites: {},
    channels: {},
    messages: {},
    typing: {},
    reads: {},
    boards: {},
    tasks: {},
    comments: {},
    pages: {},
    files: {},
    folders: {},
  }
}

let singleton: DemoStore | null = null

export function getDemoStore(): DemoStore {
  singleton ??= new DemoStore()
  return singleton
}

export function resetDemoStore(): void {
  getDemoStore().reset()
}

export function createId(prefix = 'id'): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID().slice(0, 8)}`
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
