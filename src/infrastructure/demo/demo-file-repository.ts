import type {
  FileRepository,
  FileUpdate,
  Subscriber,
  Unsubscribe,
  UploadFile,
  UploadOptions,
} from '@/domain/ports'
import type { FileMeta } from '@/domain/entities/chat'
import { NotFoundError } from '@/domain/errors'
import { buildStoragePath, validateUpload } from '@/domain/services/file-service'
import type { DemoStore } from './store'
import { createId } from './store'
import { listFiles } from './selectors'
import { forgetFileUrl, getBlobStore, resolveFileUrl } from './blob-store'

export class DemoFileRepository implements FileRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async list(workspaceId: string): Promise<FileMeta[]> {
    return this.hydrate(listFiles(this.store.getState(), workspaceId))
  }

  subscribe(workspaceId: string, callback: Subscriber<FileMeta[]>): Unsubscribe {
    let cancelled = false
    const emit = () => {
      void this.hydrate(listFiles(this.store.getState(), workspaceId)).then((files) => {
        if (!cancelled) callback(files)
      })
    }
    emit()
    const unsubscribe = this.store.subscribe(emit)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }

  async upload(
    workspaceId: string,
    file: UploadFile,
    uploadedBy: string,
    options: UploadOptions = {},
  ): Promise<FileMeta> {
    validateUpload({ name: file.name, size: file.size, contentType: file.contentType })
    const id = createId('file')
    const path = buildStoragePath(workspaceId, id, file.name)
    options.onProgress?.(10)
    await getBlobStore().put(id, file.data)
    options.onProgress?.(100)
    const now = new Date().toISOString()
    const meta: FileMeta = {
      id,
      workspaceId,
      name: file.name,
      path,
      url: '',
      size: file.size,
      contentType: file.contentType || 'application/octet-stream',
      uploadedBy,
      createdAt: now,
      updatedAt: now,
      folderId: options.folderId ?? null,
      trashedAt: null,
      backend: 'local',
    }
    this.store.commit((draft) => {
      draft.files[id] = meta
    })
    return {
      ...meta,
      url: await resolveFileUrl(id, ''),
    }
  }

  async update(workspaceId: string, fileId: string, patch: FileUpdate): Promise<void> {
    const file = this.store.getState().files[fileId]
    if (!file || file.workspaceId !== workspaceId) {
      throw new NotFoundError('El archivo no existe.')
    }
    this.store.commit((draft) => {
      const target = draft.files[fileId]
      if (!target) return
      if (patch.name !== undefined) target.name = patch.name
      if (patch.folderId !== undefined) target.folderId = patch.folderId
      if (patch.trashedAt !== undefined) target.trashedAt = patch.trashedAt
      target.updatedAt = new Date().toISOString()
    })
  }

  async getDownloadUrl(_workspaceId: string, file: FileMeta): Promise<string> {
    return resolveFileUrl(file.id, file.url)
  }

  async downloadBlob(_workspaceId: string, file: FileMeta): Promise<Blob> {
    const blob = await getBlobStore().get(file.id)
    if (!blob) throw new NotFoundError('El archivo no existe.')
    return blob
  }

  async readText(_workspaceId: string, file: FileMeta): Promise<string> {
    const url = await this.getDownloadUrl(_workspaceId, file)
    if (!url) return ''
    const response = await fetch(url)
    return response.text()
  }

  async updateText(workspaceId: string, file: FileMeta, text: string): Promise<void> {
    const current = this.store.getState().files[file.id]
    if (!current || current.workspaceId !== workspaceId) {
      throw new NotFoundError('El archivo no existe.')
    }
    const blob = new Blob([text], { type: file.contentType || 'text/plain' })
    await getBlobStore().put(file.id, blob)
    forgetFileUrl(file.id)
    this.store.commit((draft) => {
      const target = draft.files[file.id]
      if (!target) return
      target.size = blob.size
      target.updatedAt = new Date().toISOString()
      target.url = ''
    })
  }

  async remove(workspaceId: string, fileId: string): Promise<void> {
    const file = this.store.getState().files[fileId]
    if (!file || file.workspaceId !== workspaceId) {
      throw new NotFoundError('El archivo no existe.')
    }
    await getBlobStore().delete(fileId)
    forgetFileUrl(fileId)
    this.store.commit((draft) => {
      delete draft.files[fileId]
    })
  }

  private async hydrate(files: FileMeta[]): Promise<FileMeta[]> {
    return Promise.all(
      files.map(async (file) => {
        if (file.url && !file.url.startsWith('blob:')) return file
        const url = await resolveFileUrl(file.id, file.url)
        return url ? { ...file, url } : file
      }),
    )
  }
}
