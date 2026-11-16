import type { Unsubscribe } from '@/domain/ports'

const DB_NAME = 'openqomu-demo-files'
const STORE_NAME = 'blobs'

interface BlobStore {
  put(id: string, blob: Blob): Promise<void>
  get(id: string): Promise<Blob | undefined>
  delete(id: string): Promise<void>
}

class MemoryBlobStore implements BlobStore {
  private blobs = new Map<string, Blob>()

  async put(id: string, blob: Blob): Promise<void> {
    this.blobs.set(id, blob)
  }

  async get(id: string): Promise<Blob | undefined> {
    return this.blobs.get(id)
  }

  async delete(id: string): Promise<void> {
    this.blobs.delete(id)
  }
}

class IndexedDbBlobStore implements BlobStore {
  private database: Promise<IDBDatabase> | null = null

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return this.database
  }

  async put(id: string, blob: Blob): Promise<void> {
    const db = await this.open()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(blob, id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async get(id: string): Promise<Blob | undefined> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error)
    })
  }

  async delete(id: string): Promise<void> {
    const db = await this.open()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}

let store: BlobStore | null = null

export function getBlobStore(): BlobStore {
  if (store) return store
  const canUseIndexedDb =
    typeof indexedDB !== 'undefined' && typeof IDBDatabase !== 'undefined'
  store = canUseIndexedDb ? new IndexedDbBlobStore() : new MemoryBlobStore()
  return store
}

/** Caché de object URLs para que las previews sobrevivan a re-renders. */
const urlCache = new Map<string, string>()

export async function resolveFileUrl(id: string, fallback: string): Promise<string> {
  if (fallback && !fallback.startsWith('blob:')) return fallback
  const cached = urlCache.get(id)
  if (cached) return cached
  const blob = await getBlobStore().get(id)
  if (!blob) return ''
  if (typeof URL.createObjectURL !== 'function') return ''
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export function forgetFileUrl(id: string): void {
  const cached = urlCache.get(id)
  if (cached) URL.revokeObjectURL(cached)
  urlCache.delete(id)
}

export function subscribeToNothing(): Unsubscribe {
  return () => {}
}
